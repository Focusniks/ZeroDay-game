use anyhow::anyhow;
use bcrypt::{hash, verify, DEFAULT_COST};
use chrono::{Duration as ChronoDuration, Utc};
use jsonwebtoken::{Algorithm, Header, Validation};
use serde::{Deserialize, Serialize};
use sqlx::{Error as SqlxError, PgPool};
use uuid::Uuid;

use crate::{jwt_decoding_key, jwt_encoding_key};

#[derive(Serialize, Deserialize, Clone)]
pub struct User {
    pub id: String,
    pub username: String,
    pub email: String,
    pub ip_address: String,
    pub level: i32,
    pub xp: i32,
    pub reputation: i32,
    pub disk_capacity_mb: i32,
    pub role: String,
    pub created_at: Option<chrono::DateTime<Utc>>,
    pub last_login: Option<chrono::DateTime<Utc>>,
}

#[derive(Deserialize, sqlx::FromRow)]
struct DbUser {
    id: Uuid,
    username: String,
    email: String,
    password_hash: String,
    ip_address: String,
    level: i32,
    xp: i32,
    reputation: i32,
    disk_capacity_mb: i32,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: String,
    pub exp: usize,
    pub token_type: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct RefreshClaims {
    pub sub: String,
    pub exp: usize,
    pub token_type: String,
    pub refresh_id: String,
}

#[derive(Serialize, Deserialize)]
pub struct AuthResponse {
    pub token: String,
    pub refresh_token: String,
    pub user: User,
    pub expires_in: i64,
}

#[derive(Serialize, Deserialize)]
pub struct TokenRefreshResponse {
    pub token: String,
    pub refresh_token: String,
    pub expires_in: i64,
}

// ==================== РОЛИ ====================

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct UserRole {
    pub id: Uuid,
    pub user_id: Uuid,
    pub role: String,
    pub created_at: chrono::DateTime<Utc>,
}

pub async fn get_user_roles(pool: &PgPool, user_id: &Uuid) -> Result<Vec<String>, sqlx::Error> {
    let roles: Vec<UserRole> = sqlx::query_as::<_, UserRole>(
        "SELECT * FROM user_roles WHERE user_id = $1"
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    Ok(roles.into_iter().map(|r| r.role).collect())
}

pub async fn has_role(pool: &PgPool, user_id: &Uuid, role: &str) -> Result<bool, sqlx::Error> {
    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id = $1 AND role = $2)"
    )
    .bind(user_id)
    .bind(role)
    .fetch_one(pool)
    .await?;

    Ok(exists)
}

pub async fn is_admin(pool: &PgPool, user_id: &Uuid) -> Result<bool, sqlx::Error> {
    has_role(pool, user_id, "admin").await
}

pub async fn add_role_to_user(pool: &PgPool, user_id: &Uuid, role: &str) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO user_roles (user_id, role) VALUES ($1, $2) ON CONFLICT DO NOTHING"
    )
    .bind(user_id)
    .bind(role)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn remove_role_from_user(pool: &PgPool, user_id: &Uuid, role: &str) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM user_roles WHERE user_id = $1 AND role = $2")
        .bind(user_id)
        .bind(role)
        .execute(pool)
        .await?;
    Ok(())
}

// ==================== REFRESH-ТОКЕНЫ ====================

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct RefreshToken {
    pub id: Uuid,
    pub user_id: Uuid,
    pub token_hash: String,
    pub device_info: Option<String>,
    pub ip_address: Option<String>,
    pub expires_at: chrono::DateTime<Utc>,
    pub created_at: chrono::DateTime<Utc>,
    pub revoked_at: Option<chrono::DateTime<Utc>>,
}

pub async fn create_refresh_token(
    pool: &PgPool,
    user_id: &Uuid,
    token: &str,
    device_info: Option<&str>,
    ip_address: Option<&str>,
) -> Result<RefreshToken, sqlx::Error> {
    let token_hash = hash(token, DEFAULT_COST).unwrap_or_default();
    let expires_at = Utc::now() + ChronoDuration::days(30);

    sqlx::query_as::<_, RefreshToken>(
        r#"
        INSERT INTO refresh_tokens (user_id, token_hash, device_info, ip_address, expires_at)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        "#,
    )
    .bind(user_id)
    .bind(token_hash)
    .bind(device_info)
    .bind(ip_address)
    .bind(expires_at)
    .fetch_one(pool)
    .await
}

pub async fn verify_refresh_token(
    pool: &PgPool,
    user_id: &Uuid,
    token: &str,
) -> Result<Option<RefreshToken>, sqlx::Error> {
    let tokens = sqlx::query_as::<_, RefreshToken>(
        r#"
        SELECT * FROM refresh_tokens 
        WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW()
        ORDER BY created_at DESC
        "#
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    for stored_token in tokens {
        if verify(token, &stored_token.token_hash).unwrap_or(false) {
            return Ok(Some(stored_token));
        }
    }

    Ok(None)
}

pub async fn revoke_refresh_token(pool: &PgPool, token_id: &Uuid) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1")
        .bind(token_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn revoke_all_user_tokens(pool: &PgPool, user_id: &Uuid) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1")
        .bind(user_id)
        .execute(pool)
        .await?;
    Ok(())
}

// ==================== JWT ТОКЕНЫ ====================

pub async fn register_user(
    pool: &PgPool,
    jwt_secret: &str,
    username: &str,
    email: &str,
    password: &str,
) -> anyhow::Result<AuthResponse> {
    validate_register_input(username, email, password)?;

    let username = username.trim().to_lowercase();
    let email = email.trim().to_lowercase();
    let password_hash = hash(password, DEFAULT_COST)?;
    let ip_address = generate_ip();

    let db_user = sqlx::query_as::<_, DbUser>(
        r#"
        INSERT INTO users (username, email, password_hash, ip_address)
        VALUES ($1, $2, $3, $4)
        RETURNING id, username, email, password_hash, ip_address, level, xp, reputation, disk_capacity_mb
        "#,
    )
    .bind(&username)
    .bind(&email)
    .bind(&password_hash)
    .bind(&ip_address)
    .fetch_one(pool)
    .await
    .map_err(map_register_sqlx_error)?;

    // Роли назначаются автоматически через триггер, но получим их явно
    let roles = get_user_roles(pool, &db_user.id).await?;
    let primary_role = roles.iter().find(|r| *r == "admin")
        .or_else(|| roles.iter().find(|r| *r == "beta_tester"))
        .cloned()
        .unwrap_or_else(|| "user".to_string());

    let (token, refresh_token) = generate_tokens(&db_user.id, jwt_secret)?;
    
    // Создаём refresh-токен в БД
    create_refresh_token(pool, &db_user.id, &refresh_token, None, Some(&ip_address)).await.ok();

    Ok(AuthResponse {
        token,
        refresh_token,
        user: to_public_user_with_role(db_user, &primary_role),
        expires_in: 3600,
    })
}

pub async fn login_user(
    pool: &PgPool,
    jwt_secret: &str,
    login: &str,
    password: &str,
    device_info: Option<&str>,
    ip_address: Option<&str>,
) -> anyhow::Result<AuthResponse> {
    let identifier = login.trim();
    if identifier.is_empty() || password.is_empty() {
        return Err(anyhow!("Укажите логин и пароль."));
    }

    let is_email = identifier.contains('@');
    let normalized = identifier.to_lowercase();

    let db_user = if is_email {
        sqlx::query_as::<_, DbUser>(
            r#"
            SELECT id, username, email, password_hash, ip_address, level, xp, reputation, disk_capacity_mb
            FROM users
            WHERE email = $1
            "#,
        )
        .bind(&normalized)
        .fetch_optional(pool)
        .await?
    } else {
        sqlx::query_as::<_, DbUser>(
            r#"
            SELECT id, username, email, password_hash, ip_address, level, xp, reputation, disk_capacity_mb
            FROM users
            WHERE username = $1
            "#,
        )
        .bind(&normalized)
        .fetch_optional(pool)
        .await?
    }
    .ok_or_else(|| anyhow!("Неверный логин или пароль."))?;

    match verify(password, &db_user.password_hash) {
        Ok(true) => { /* password correct */ }
        Ok(false) => return Err(anyhow!("Неверный логин или пароль.")),
        Err(e) => {
            log::error!("Bcrypt password verification failed for user {}: {}", db_user.email, e);
            return Err(anyhow!("Ошибка проверки пароля. Попробуйте позже."));
        }
    }

    sqlx::query("UPDATE users SET last_login = NOW() WHERE id = $1")
        .bind(db_user.id)
        .execute(pool)
        .await
        .ok();

    // Получаем роли
    let roles = get_user_roles(pool, &db_user.id).await?;
    let primary_role = roles.iter().find(|r| *r == "admin")
        .or_else(|| roles.iter().find(|r| *r == "beta_tester"))
        .cloned()
        .unwrap_or_else(|| "user".to_string());

    let (token, refresh_token) = generate_tokens(&db_user.id, jwt_secret)?;
    
    // Создаём refresh-токен в БД
    create_refresh_token(pool, &db_user.id, &refresh_token, device_info, ip_address).await.ok();

    Ok(AuthResponse {
        token,
        refresh_token,
        user: to_public_user_with_role(db_user, &primary_role),
        expires_in: 3600,
    })
}

pub async fn refresh_tokens(
    pool: &PgPool,
    jwt_secret: &str,
    user_id: &Uuid,
    refresh_token: &str,
) -> anyhow::Result<TokenRefreshResponse> {
    // Находим валидный refresh-токен
    let stored_token = verify_refresh_token(pool, user_id, refresh_token)
        .await?
        .ok_or_else(|| anyhow!("Недействительный refresh-токен."))?;

    // Отзываем старый токен
    revoke_refresh_token(pool, &stored_token.id).await?;

    // Генерируем новую пару токенов
    let (new_token, new_refresh_token) = generate_tokens(user_id, jwt_secret)?;
    
    // Создаём новый refresh-токен
    create_refresh_token(pool, user_id, &new_refresh_token, stored_token.device_info.as_deref(), stored_token.ip_address.as_deref()).await?;

    Ok(TokenRefreshResponse {
        token: new_token,
        refresh_token: new_refresh_token,
        expires_in: 3600,
    })
}

pub async fn logout_user(pool: &PgPool, user_id: &Uuid, refresh_token: Option<&str>) -> anyhow::Result<()> {
    if let Some(token) = refresh_token {
        if let Ok(Some(stored_token)) = verify_refresh_token(pool, user_id, token).await {
            revoke_refresh_token(pool, &stored_token.id).await?;
        }
    }
    Ok(())
}

pub async fn authorize_user(pool: &PgPool, jwt_secret: &str, token: &str) -> anyhow::Result<User> {
    let token = token.trim();
    if token.is_empty() {
        return Err(anyhow!("Empty token"));
    }

    let claims = decode_jwt_claims(token, jwt_secret)?;
    let user_id = Uuid::parse_str(&claims.sub).map_err(|e| anyhow!("Invalid token subject: {e}"))?;

    let db_user = sqlx::query_as::<_, DbUser>(
        r#"
        SELECT id, username, email, password_hash, ip_address, level, xp, reputation, disk_capacity_mb
        FROM users
        WHERE id = $1
        "#,
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| anyhow!("User not found"))?;

    // Получаем роль
    let roles = get_user_roles(pool, &db_user.id).await?;
    let primary_role = roles.iter().find(|r| *r == "admin")
        .or_else(|| roles.iter().find(|r| *r == "beta_tester"))
        .cloned()
        .unwrap_or_else(|| "user".to_string());

    Ok(to_public_user_with_role(db_user, &primary_role))
}

pub async fn get_user_by_id(pool: &PgPool, user_id: &Uuid) -> anyhow::Result<User> {
    let db_user = sqlx::query_as::<_, DbUser>(
        r#"
        SELECT id, username, email, password_hash, ip_address, level, xp, reputation, disk_capacity_mb
        FROM users
        WHERE id = $1
        "#,
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| anyhow!("User not found"))?;

    let roles = get_user_roles(pool, &db_user.id).await?;
    let primary_role = roles.iter().find(|r| *r == "admin")
        .or_else(|| roles.iter().find(|r| *r == "beta_tester"))
        .cloned()
        .unwrap_or_else(|| "user".to_string());

    Ok(to_public_user_with_role(db_user, &primary_role))
}

pub async fn change_password(
    pool: &PgPool,
    user_id: &str,
    current_password: &str,
    new_password: &str,
) -> anyhow::Result<()> {
    if current_password.is_empty() {
        return Err(anyhow!("Текущий пароль обязателен."));
    }
    if new_password.len() < 8 {
        return Err(anyhow!("Новый пароль должен быть не короче 8 символов."));
    }

    let user_id = Uuid::parse_str(user_id).map_err(|e| anyhow!("Invalid user id: {e}"))?;
    let db_user = sqlx::query_as::<_, DbUser>(
        r#"
        SELECT id, username, email, password_hash, ip_address, level, xp, reputation, disk_capacity_mb
        FROM users
        WHERE id = $1
        "#,
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| anyhow!("User not found"))?;

    match verify(current_password, &db_user.password_hash) {
        Ok(true) => { /* current password correct */ }
        Ok(false) => return Err(anyhow!("Текущий пароль неверный.")),
        Err(e) => {
            log::error!("Bcrypt verification failed during password change for user {}: {}", user_id, e);
            return Err(anyhow!("Ошибка проверки текущего пароля."));
        }
    }

    let new_hash = hash(new_password, DEFAULT_COST)?;
    sqlx::query("UPDATE users SET password_hash = $1 WHERE id = $2")
        .bind(new_hash)
        .bind(user_id)
        .execute(pool)
        .await?;

    // Отзываем все refresh-токены после смены пароля
    revoke_all_user_tokens(pool, &user_id).await?;

    Ok(())
}

pub fn decode_user_id_from_jwt(token: &str, secret: &str) -> anyhow::Result<String> {
    let claims = decode_jwt_claims(token, secret)?;
    Ok(claims.sub)
}

pub fn verify_jwt(token: &str, secret: &str) -> bool {
    let validation = Validation::new(Algorithm::HS256);
    jsonwebtoken::decode::<Claims>(token, &jwt_decoding_key(secret), &validation).is_ok()
}

// ==================== ВНУТРЕННИЕ ФУНКЦИИ ====================

fn decode_jwt_claims(token: &str, secret: &str) -> anyhow::Result<Claims> {
    let validation = Validation::new(Algorithm::HS256);
    let token_data = jsonwebtoken::decode::<Claims>(token, &jwt_decoding_key(secret), &validation)
        .map_err(|e| anyhow!("JWT verification failed: {e}"))?;
    Ok(token_data.claims)
}

fn generate_tokens(user_id: &Uuid, secret: &str) -> anyhow::Result<(String, String)> {
    // Access token - 1 час
    let exp = (Utc::now() + ChronoDuration::hours(1)).timestamp() as usize;
    let claims = Claims {
        sub: user_id.to_string(),
        exp,
        token_type: "access".to_string(),
    };

    let token = jsonwebtoken::encode(
        &Header::new(Algorithm::HS256),
        &claims,
        &jwt_encoding_key(secret),
    )?;

    // Refresh token - 30 дней
    let refresh_exp = (Utc::now() + ChronoDuration::days(30)).timestamp() as usize;
    let refresh_id = Uuid::new_v4().to_string();
    let refresh_claims = RefreshClaims {
        sub: user_id.to_string(),
        exp: refresh_exp,
        token_type: "refresh".to_string(),
        refresh_id,
    };

    let refresh_token = jsonwebtoken::encode(
        &Header::new(Algorithm::HS256),
        &refresh_claims,
        &jwt_encoding_key(secret),
    )?;

    Ok((token, refresh_token))
}

#[allow(dead_code)]

fn generate_jwt(user_id: Uuid, secret: &str) -> anyhow::Result<String> {
    let exp = (Utc::now() + ChronoDuration::hours(24)).timestamp() as usize;
    let claims = Claims {
        sub: user_id.to_string(),
        exp,
        token_type: "access".to_string(),
    };

    let token = jsonwebtoken::encode(
        &Header::new(Algorithm::HS256),
        &claims,
        &jwt_encoding_key(secret),
    )?;
    Ok(token)
}

fn generate_ip() -> String {
    let a: u8 = rand::random_range(1..=254);
    let b: u8 = rand::random_range(1..=254);
    format!("192.168.{a}.{b}")
}

fn map_register_sqlx_error(e: SqlxError) -> anyhow::Error {
    if let Some(db) = e.as_database_error() {
        if db.code().as_deref() == Some("23505") {
            let c = db.constraint().unwrap_or("");
            if c.contains("email") {
                return anyhow!("Этот адрес электронной почты уже зарегистрирован в сети ZeroDay.");
            }
            if c.contains("username") {
                return anyhow!("Это имя пользователя уже занято в системе ZeroDay.");
            }
            return anyhow!("Учётная запись с такими данными уже существует в ZeroDay.");
        }
    }
    anyhow!("Не удалось завершить регистрацию. Попробуйте позже.")
}

fn validate_register_input(username: &str, email: &str, password: &str) -> anyhow::Result<()> {
    let username = username.trim();
    let email = email.trim();

    if !(3..=20).contains(&username.len()) {
        return Err(anyhow!("Имя пользователя: от 3 до 20 символов."));
    }
    if !username
        .chars()
        .all(|ch| ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == '_')
    {
        return Err(anyhow!("Имя пользователя: только латиница в нижнем регистре, цифры и символ «_»."));
    }
    if !email.contains('@') || !email.contains('.') {
        return Err(anyhow!("Некорректный формат email."));
    }
    if password.len() < 8 {
        return Err(anyhow!("Пароль должен быть не короче 8 символов."));
    }
    Ok(())
}

#[allow(dead_code)]
fn to_public_user(db_user: DbUser) -> User {
    User {
        id: db_user.id.to_string(),
        username: db_user.username,
        email: db_user.email,
        ip_address: db_user.ip_address,
        level: db_user.level,
        xp: db_user.xp,
        reputation: db_user.reputation,
        disk_capacity_mb: db_user.disk_capacity_mb,
        role: "user".to_string(),
        created_at: None,
        last_login: None,
    }
}

fn to_public_user_with_role(db_user: DbUser, role: &str) -> User {
    User {
        id: db_user.id.to_string(),
        username: db_user.username,
        email: db_user.email,
        ip_address: db_user.ip_address,
        level: db_user.level,
        xp: db_user.xp,
        reputation: db_user.reputation,
        disk_capacity_mb: db_user.disk_capacity_mb,
        role: role.to_string(),
        created_at: None,
        last_login: None,
    }
}
