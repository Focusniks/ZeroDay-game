//! Модуль администрирования
//! Эндпоинты для управления пользователями, статистики и модерации

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::auth::{get_user_roles, is_admin as check_is_admin};

// ==================== ТИПЫ ====================

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct AdminLog {
    pub id: Uuid,
    pub admin_id: Option<Uuid>,
    pub admin_username: Option<String>,
    pub action: String,
    pub target_user_id: Option<Uuid>,
    pub target_username: Option<String>,
    pub details: Option<serde_json::Value>,
    pub ip_address: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct BetaApplication {
    pub id: Uuid,
    pub email: String,
    pub source: String,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub reviewed_at: Option<DateTime<Utc>>,
    pub reviewed_by: Option<Uuid>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdminStats {
    pub total_users: i64,
    pub new_users_today: i64,
    pub new_users_week: i64,
    pub new_users_month: i64,
    pub total_beta_applications: i64,
    pub pending_beta_applications: i64,
    pub online_users: i64,
    pub banned_users: i64,
    pub active_admins: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserWithRoles {
    pub id: String,
    pub username: String,
    pub email: String,
    pub ip_address: String,
    pub level: i32,
    pub xp: i32,
    pub reputation: i32,
    pub disk_capacity_mb: i32,
    pub role: String,
    pub created_at: Option<DateTime<Utc>>,
    pub last_login: Option<DateTime<Utc>>,
    pub is_banned: bool,
    pub roles: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginatedUsers {
    pub items: Vec<UserWithRoles>,
    pub total: i64,
    pub page: i64,
    pub per_page: i64,
    pub total_pages: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginatedLogs {
    pub items: Vec<AdminLog>,
    pub total: i64,
    pub page: i64,
    pub per_page: i64,
    pub total_pages: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginatedBetaApplications {
    pub items: Vec<BetaApplication>,
    pub total: i64,
    pub page: i64,
    pub per_page: i64,
    pub total_pages: i64,
}

// ==================== ПРОВЕРКА ПРАВ ====================

pub async fn require_admin(pool: &PgPool, user_id: &Uuid) -> anyhow::Result<()> {
    if !check_is_admin(pool, user_id).await? {
        return Err(anyhow::anyhow!("Доступ запрещён. Требуются права администратора."));
    }
    Ok(())
}

// ==================== СТАТИСТИКА ====================

pub async fn get_admin_stats(pool: &PgPool) -> anyhow::Result<AdminStats> {
    let total_users: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users")
        .fetch_one(pool)
        .await?;

    let new_users_today: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM users WHERE created_at >= CURRENT_DATE"
    )
    .fetch_one(pool)
    .await?;

    let new_users_week: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '7 days'"
    )
    .fetch_one(pool)
    .await?;

    let new_users_month: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '30 days'"
    )
    .fetch_one(pool)
    .await?;

    let total_beta_applications: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM beta_applications"
    )
    .fetch_one(pool)
    .await?;

    let pending_beta_applications: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM beta_applications WHERE status = 'pending'"
    )
    .fetch_one(pool)
    .await?;

    let online_users: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM user_online_status WHERE is_online = true"
    )
    .fetch_one(pool)
    .await?;

    let banned_users: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM users WHERE id IN (SELECT user_id FROM user_roles WHERE role = 'banned')"
    )
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    let active_admins: i64 = sqlx::query_scalar(
        "SELECT COUNT(DISTINCT user_id) FROM user_online_status WHERE is_online = true AND user_id IN (SELECT user_id FROM user_roles WHERE role = 'admin')"
    )
    .fetch_one(pool)
    .await?;

    Ok(AdminStats {
        total_users,
        new_users_today,
        new_users_week,
        new_users_month,
        total_beta_applications,
        pending_beta_applications,
        online_users,
        banned_users,
        active_admins,
    })
}

// ==================== УПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯМИ ====================

pub async fn get_users(
    pool: &PgPool,
    page: i64,
    per_page: i64,
    search: Option<&str>,
    _sort_by: Option<&str>,
) -> anyhow::Result<PaginatedUsers> {
    let offset = (page - 1) * per_page;
    let search_pattern = search.map(|s| format!("%{}%", s.to_lowercase()));

    let (count_query, data_query) = if search_pattern.is_some() {
        (
            r#"
            SELECT COUNT(*) FROM users 
            WHERE LOWER(username) LIKE $1 OR LOWER(email) LIKE $1
            "#,
            r#"
            SELECT u.*, 
                EXISTS(SELECT 1 FROM user_roles WHERE user_id = u.id AND role = 'banned') as is_banned
            FROM users u
            WHERE LOWER(u.username) LIKE $1 OR LOWER(u.email) LIKE $1
            ORDER BY u.created_at DESC
            LIMIT $2 OFFSET $3
            "#,
        )
    } else {
        (
            "SELECT COUNT(*) FROM users",
            r#"
            SELECT u.*,
                EXISTS(SELECT 1 FROM user_roles WHERE user_id = u.id AND role = 'banned') as is_banned
            FROM users u
            ORDER BY u.created_at DESC
            LIMIT $1 OFFSET $2
            "#,
        )
    };

    let total: i64 = if let Some(ref pattern) = search_pattern {
        sqlx::query_scalar(count_query)
            .bind(pattern)
            .fetch_one(pool)
            .await?
    } else {
        sqlx::query_scalar(count_query)
            .fetch_one(pool)
            .await?
    };

    let users: Vec<(sqlx::types::Uuid, String, String, String, i32, i32, i32, i32, chrono::DateTime<Utc>, Option<chrono::DateTime<Utc>>, bool)> = 
        if let Some(ref pattern) = search_pattern {
            sqlx::query_as(data_query)
                .bind(pattern)
                .bind(per_page)
                .bind(offset)
                .fetch_all(pool)
                .await?
        } else {
            sqlx::query_as(data_query)
                .bind(per_page)
                .bind(offset)
                .fetch_all(pool)
                .await?
        };

    let mut items = Vec::new();
    for u in users {
        let roles = get_user_roles(pool, &u.0).await?;
        let primary_role = roles.iter().find(|r| *r == "admin")
            .or_else(|| roles.iter().find(|r| *r == "beta_tester"))
            .cloned()
            .unwrap_or_else(|| "user".to_string());
        
        items.push(UserWithRoles {
            id: u.0.to_string(),
            username: u.1,
            email: u.2,
            ip_address: u.3,
            level: u.4,
            xp: u.5,
            reputation: u.6,
            disk_capacity_mb: u.7,
            role: primary_role,
            created_at: Some(u.8),
            last_login: u.9,
            is_banned: u.10,
            roles,
        });
    }

    let total_pages = (total as f64 / per_page as f64).ceil() as i64;

    Ok(PaginatedUsers {
        items,
        total,
        page,
        per_page,
        total_pages,
    })
}

pub async fn get_user_by_id(pool: &PgPool, user_id: &Uuid) -> anyhow::Result<Option<UserWithRoles>> {
    let user: Option<(Uuid, String, String, String, i32, i32, i32, i32, chrono::DateTime<Utc>, Option<chrono::DateTime<Utc>>)> =
        sqlx::query_as(
            r#"
            SELECT id, username, email, ip_address, level, xp, reputation, disk_capacity_mb, created_at, last_login
            FROM users WHERE id = $1
            "#,
        )
        .bind(user_id)
        .fetch_optional(pool)
        .await?;

    if let Some(u) = user {
        let roles = get_user_roles(pool, &u.0).await?;
        let primary_role = roles.iter().find(|r| *r == "admin")
            .or_else(|| roles.iter().find(|r| *r == "beta_tester"))
            .cloned()
            .unwrap_or_else(|| "user".to_string());
        
        Ok(Some(UserWithRoles {
            id: u.0.to_string(),
            username: u.1,
            email: u.2,
            ip_address: u.3,
            level: u.4,
            xp: u.5,
            reputation: u.6,
            disk_capacity_mb: u.7,
            role: primary_role,
            created_at: Some(u.8),
            last_login: u.9,
            is_banned: roles.contains(&"banned".to_string()),
            roles,
        }))
    } else {
        Ok(None)
    }
}

pub async fn update_user(
    pool: &PgPool,
    admin_id: &Uuid,
    user_id: &Uuid,
    updates: serde_json::Value,
) -> anyhow::Result<UserWithRoles> {
    // Получаем текущие данные
    let user = get_user_by_id(pool, user_id)
        .await?
        .ok_or_else(|| anyhow::anyhow!("Пользователь не найден"))?;

    // Логируем изменение
    log_admin_action(
        pool,
        admin_id,
        "update_user",
        Some(*user_id),
        Some(&user.username),
        Some(updates.clone()),
    ).await?;

    // Применяем обновления
    if let Some(level) = updates.get("level").and_then(|v| v.as_i64()) {
        sqlx::query("UPDATE users SET level = $1 WHERE id = $2")
            .bind(level as i32)
            .bind(user_id)
            .execute(pool)
            .await?;
    }

    if let Some(xp) = updates.get("xp").and_then(|v| v.as_i64()) {
        sqlx::query("UPDATE users SET xp = $1 WHERE id = $2")
            .bind(xp as i32)
            .bind(user_id)
            .execute(pool)
            .await?;
    }

    if let Some(reputation) = updates.get("reputation").and_then(|v| v.as_i64()) {
        sqlx::query("UPDATE users SET reputation = $1 WHERE id = $2")
            .bind(reputation as i32)
            .bind(user_id)
            .execute(pool)
            .await?;
    }

    if let Some(disk_capacity) = updates.get("disk_capacity_mb").and_then(|v| v.as_i64()) {
        sqlx::query("UPDATE users SET disk_capacity_mb = $1 WHERE id = $2")
            .bind(disk_capacity as i32)
            .bind(user_id)
            .execute(pool)
            .await?;
    }

    // Возвращаем обновлённого пользователя
    get_user_by_id(pool, user_id)
        .await?
        .ok_or_else(|| anyhow::anyhow!("Пользователь не найден после обновления"))
}

pub async fn ban_user(
    pool: &PgPool,
    admin_id: &Uuid,
    user_id: &Uuid,
    banned: bool,
) -> anyhow::Result<()> {
    let target_username: Option<String> = sqlx::query_scalar(
        "SELECT username FROM users WHERE id = $1"
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await?;

    if banned {
        // Добавляем роль banned
        sqlx::query("INSERT INTO user_roles (user_id, role) VALUES ($1, 'banned') ON CONFLICT DO NOTHING")
            .bind(user_id)
            .execute(pool)
            .await?;
    } else {
        // Удаляем роль banned
        sqlx::query("DELETE FROM user_roles WHERE user_id = $1 AND role = 'banned'")
            .bind(user_id)
            .execute(pool)
            .await?;
    }

    // Логируем действие
    log_admin_action(
        pool,
        admin_id,
        if banned { "ban_user" } else { "unban_user" },
        Some(*user_id),
        target_username.as_deref(),
        Some(serde_json::json!({ "banned": banned })),
    ).await?;

    Ok(())
}

pub async fn change_user_role(
    pool: &PgPool,
    admin_id: &Uuid,
    user_id: &Uuid,
    new_role: &str,
) -> anyhow::Result<()> {
    let target_username: Option<String> = sqlx::query_scalar(
        "SELECT username FROM users WHERE id = $1"
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await?;

    // Удаляем старую роль (user, beta_tester, admin, moderator)
    let old_roles = ["user", "beta_tester", "admin", "moderator"];
    for role in old_roles.iter() {
        sqlx::query("DELETE FROM user_roles WHERE user_id = $1 AND role = $2")
            .bind(user_id)
            .bind(role)
            .execute(pool)
            .await?;
    }

    // Добавляем новую роль
    sqlx::query("INSERT INTO user_roles (user_id, role) VALUES ($1, $2) ON CONFLICT DO NOTHING")
        .bind(user_id)
        .bind(new_role)
        .execute(pool)
        .await?;

    // Логируем действие
    log_admin_action(
        pool,
        admin_id,
        "change_role",
        Some(*user_id),
        target_username.as_deref(),
        Some(serde_json::json!({ "new_role": new_role })),
    ).await?;

    Ok(())
}

// ==================== ЛОГИ ====================

pub async fn get_admin_logs(
    pool: &PgPool,
    page: i64,
    per_page: i64,
) -> anyhow::Result<PaginatedLogs> {
    let offset = (page - 1) * per_page;

    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM admin_logs")
        .fetch_one(pool)
        .await?;

    let logs: Vec<AdminLog> = sqlx::query_as(
        r#"
        SELECT * FROM admin_logs
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2
        "#,
    )
    .bind(per_page)
    .bind(offset)
    .fetch_all(pool)
    .await?;

    let total_pages = (total as f64 / per_page as f64).ceil() as i64;

    Ok(PaginatedLogs {
        items: logs,
        total,
        page,
        per_page,
        total_pages,
    })
}

pub async fn log_admin_action(
    pool: &PgPool,
    admin_id: &Uuid,
    action: &str,
    target_user_id: Option<Uuid>,
    target_username: Option<&str>,
    details: Option<serde_json::Value>,
) -> anyhow::Result<()> {
    let admin_username: Option<String> = sqlx::query_scalar(
        "SELECT username FROM users WHERE id = $1"
    )
    .bind(admin_id)
    .fetch_optional(pool)
    .await?;

    sqlx::query(
        r#"
        INSERT INTO admin_logs (admin_id, admin_username, action, target_user_id, target_username, details)
        VALUES ($1, $2, $3, $4, $5, $6)
        "#,
    )
    .bind(admin_id)
    .bind(admin_username)
    .bind(action)
    .bind(target_user_id)
    .bind(target_username)
    .bind(details)
    .execute(pool)
    .await?;

    Ok(())
}

// ==================== БЕТА-ЗАЯВКИ ====================

pub async fn get_beta_applications(
    pool: &PgPool,
    page: i64,
    per_page: i64,
    status: Option<&str>,
) -> anyhow::Result<PaginatedBetaApplications> {
    let offset = (page - 1) * per_page;

    let (count_query, data_query) = if let Some(status) = status {
        (
            format!("SELECT COUNT(*) FROM beta_applications WHERE status = '{}'", status),
            format!(
                "SELECT * FROM beta_applications WHERE status = '{}' ORDER BY created_at DESC LIMIT {} OFFSET {}",
                status, per_page, offset
            ),
        )
    } else {
        (
            "SELECT COUNT(*) FROM beta_applications".to_string(),
            format!(
                "SELECT * FROM beta_applications ORDER BY created_at DESC LIMIT {} OFFSET {}",
                per_page, offset
            ),
        )
    };

    let total: i64 = sqlx::query_scalar(&count_query)
        .fetch_one(pool)
        .await?;

    let applications: Vec<BetaApplication> = sqlx::query_as(&data_query)
        .fetch_all(pool)
        .await?;

    let total_pages = (total as f64 / per_page as f64).ceil() as i64;

    Ok(PaginatedBetaApplications {
        items: applications,
        total,
        page,
        per_page,
        total_pages,
    })
}

pub async fn update_beta_application(
    pool: &PgPool,
    admin_id: &Uuid,
    application_id: &Uuid,
    new_status: &str,
) -> anyhow::Result<()> {
    sqlx::query(
        r#"
        UPDATE beta_applications 
        SET status = $1, reviewed_at = NOW(), reviewed_by = $2
        WHERE id = $3
        "#,
    )
    .bind(new_status)
    .bind(admin_id)
    .bind(application_id)
    .execute(pool)
    .await?;

    // Логируем действие
    log_admin_action(
        pool,
        admin_id,
        "update_beta_application",
        None,
        None,
        Some(serde_json::json!({ "application_id": application_id.to_string(), "new_status": new_status })),
    ).await?;

    Ok(())
}

// ==================== ОНЛАЙН СТАТУС ====================

pub async fn update_online_status(pool: &PgPool, user_id: &Uuid, is_online: bool) -> anyhow::Result<()> {
    sqlx::query(
        r#"
        INSERT INTO user_online_status (user_id, is_online, last_seen, last_activity)
        VALUES ($1, $2, NOW(), NOW())
        ON CONFLICT (user_id) DO UPDATE SET
            is_online = $2,
            last_activity = NOW(),
            last_seen = CASE WHEN $2 = false THEN NOW() ELSE user_online_status.last_seen END
        "#,
    )
    .bind(user_id)
    .bind(is_online)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn get_online_users(pool: &PgPool) -> anyhow::Result<Vec<Uuid>> {
    let users: Vec<Uuid> = sqlx::query_scalar(
        "SELECT user_id FROM user_online_status WHERE is_online = true"
    )
    .fetch_all(pool)
    .await?;

    Ok(users)
}

// ==================== АКТИВНОСТЬ ПОЛЬЗОВАТЕЛЯ ====================

pub async fn log_user_activity(
    pool: &PgPool,
    user_id: &Uuid,
    activity_type: &str,
    details: Option<serde_json::Value>,
    ip_address: Option<&str>,
) -> anyhow::Result<()> {
    sqlx::query(
        r#"
        INSERT INTO user_activity_log (user_id, activity_type, details, ip_address)
        VALUES ($1, $2, $3, $4)
        "#,
    )
    .bind(user_id)
    .bind(activity_type)
    .bind(details)
    .bind(ip_address)
    .execute(pool)
    .await?;

    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct UserActivity {
    pub id: Uuid,
    pub user_id: Uuid,
    pub activity_type: String,
    pub details: Option<serde_json::Value>,
    pub ip_address: Option<String>,
    pub created_at: DateTime<Utc>,
}

pub async fn get_user_activity(
    pool: &PgPool,
    user_id: &Uuid,
    page: i64,
    per_page: i64,
) -> anyhow::Result<Vec<UserActivity>> {
    let offset = (page - 1) * per_page;

    let activities: Vec<UserActivity> = sqlx::query_as(
        r#"
        SELECT * FROM user_activity_log
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
        "#,
    )
    .bind(user_id)
    .bind(per_page)
    .bind(offset)
    .fetch_all(pool)
    .await?;

    Ok(activities)
}
