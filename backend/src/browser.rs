use actix_web::{web, HttpResponse};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool};
use uuid::Uuid;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct BrowserSite {
    pub id: Uuid,
    pub name: String,
    pub url: String,
    pub description: Option<String>,
    pub icon_url: Option<String>,
    pub category: String,
    pub is_indexed: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct BrowserBookmark {
    pub id: Uuid,
    pub user_id: Uuid,
    pub site_id: Option<Uuid>,
    pub custom_url: Option<String>,
    pub custom_name: Option<String>,
    pub custom_icon_url: Option<String>,
    pub position: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct BrowserSettings {
    pub id: Uuid,
    pub user_id: Uuid,
    pub homepage_url: String,
    pub search_engine: String,
    pub theme: String,
    pub show_bookmarks_bar: bool,
    pub auto_play_media: bool,
    pub block_popups: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>
}

#[derive(Debug, Deserialize)]
pub struct CreateBookmarkPayload {
    pub site_id: Option<Uuid>,
    pub custom_url: Option<String>,
    pub custom_name: Option<String>,
    pub custom_icon_url: Option<String>
}

#[derive(Debug, Deserialize)]
pub struct UpdateBookmarkPayload {
    pub custom_url: String,
    pub custom_name: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateSettingsPayload {
    pub homepage_url: Option<String>,
    pub search_engine: Option<String>,
    pub theme: Option<String>,
    pub show_bookmarks_bar: Option<bool>,
    pub auto_play_media: Option<bool>,
    pub block_popups: Option<bool>
}

#[derive(Debug, Deserialize)]
pub struct SearchQuery {
    pub q: String
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct BrowserHistory {
    pub id: Uuid,
    pub user_id: Uuid,
    pub url: String,
    pub title: Option<String>,
    pub visited_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct AppendHistoryPayload {
    pub url: String,
    pub title: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct HistoryListQuery {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct ClearHistoryQuery {
    /// `all` or `older_than`
    #[serde(default = "default_history_clear_scope")]
    pub scope: String,
    pub hours: Option<i32>,
    pub days: Option<i32>,
}

fn default_history_clear_scope() -> String {
    "all".to_string()
}

fn clamp_history_str(s: &str, max: usize) -> String {
    s.chars().take(max).collect()
}

pub async fn get_sites(pool: &PgPool) -> HttpResponse {
    let sites = sqlx::query_as::<_, BrowserSite>(
        r#"
        SELECT
            id, name, url, description, icon_url,
            COALESCE(category, 'general') AS category,
            is_indexed, created_at, updated_at
        FROM browser_sites
        WHERE is_indexed = TRUE
        ORDER BY category, name
        "#
    )
    .fetch_all(pool)
    .await;

    match sites {
        Ok(sites) => HttpResponse::Ok().json(sites),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": format!("Failed to fetch sites: {}", e)
        }))
    }
}

pub async fn search_sites(pool: &PgPool, query: web::Query<SearchQuery>) -> HttpResponse {
    let q_norm = query.q.trim().to_lowercase();
    if q_norm.is_empty() {
        return HttpResponse::Ok().json(Vec::<BrowserSite>::new());
    }

    let search_term = format!("%{}%", q_norm);

    let sites = sqlx::query_as::<_, BrowserSite>(
        r#"
        SELECT
            bs.id,
            bs.name,
            bs.url,
            bs.description,
            bs.icon_url,
            COALESCE(bs.category, 'general') AS category,
            bs.is_indexed,
            bs.created_at,
            bs.updated_at
        FROM browser_sites bs
        WHERE bs.is_indexed = TRUE
        AND (
            LOWER(bs.name) LIKE $1
            OR LOWER(COALESCE(bs.description, '')) LIKE $1
            OR LOWER(bs.category) LIKE $1
            OR LOWER(bs.url) LIKE $1
            OR EXISTS (
                SELECT 1 FROM browser_search_index bsi
                WHERE bsi.site_id = bs.id
                AND (
                    LOWER(bsi.title) LIKE $1
                    OR LOWER(COALESCE(bsi.content, '')) LIKE $1
                    OR EXISTS (
                        SELECT 1
                        FROM unnest(COALESCE(bsi.keywords, ARRAY[]::text[])) AS kw(word)
                        WHERE LOWER(word) LIKE $1
                    )
                )
            )
        )
        ORDER BY
            CASE WHEN LOWER(TRIM(bs.name)) = $2 THEN 100 ELSE 0 END DESC,
            CASE WHEN LOWER(bs.name) LIKE ($2 || '%') AND LOWER(TRIM(bs.name)) <> $2 THEN 50 ELSE 0 END DESC,
            CASE WHEN LOWER(bs.url) LIKE $1 THEN 40 ELSE 0 END DESC,
            CASE WHEN LOWER(COALESCE(bs.description, '')) LIKE $1 THEN 15 ELSE 0 END DESC,
            CASE WHEN bs.category = 'system' THEN 5 ELSE 0 END DESC,
            bs.name ASC
        LIMIT 50
        "#
    )
    .bind(&search_term)
    .bind(&q_norm)
    .fetch_all(pool)
    .await;

    match sites {
        Ok(sites) => HttpResponse::Ok().json(sites),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": format!("Search failed: {}", e)
        }))
    }
}

pub async fn get_bookmarks(
    pool: &PgPool,
    user_id: Uuid
) -> HttpResponse {
    let bookmarks = sqlx::query_as::<_, BrowserBookmark>(
        "SELECT * FROM browser_bookmarks WHERE user_id = $1 ORDER BY position"
    )
    .bind(user_id)
    .fetch_all(pool)
    .await;

    match bookmarks {
        Ok(bookmarks) => HttpResponse::Ok().json(bookmarks),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": format!("Failed to fetch bookmarks: {}", e)
        }))
    }
}

pub async fn create_bookmark(
    pool: &PgPool,
    user_id: Uuid,
    payload: CreateBookmarkPayload
) -> HttpResponse {
    // Get max position (handles NULL from empty table)
    let max_pos = sqlx::query_scalar::<_, Option<i32>>(
        "SELECT MAX(position) FROM browser_bookmarks WHERE user_id = $1"
    )
    .bind(user_id)
    .fetch_one(pool)
    .await
    .map_err(|e| {
        log::warn!("Failed to get max bookmark position for user {}: {}", user_id, e);
        e
    })
    .unwrap_or(Some(0))
    .unwrap_or(0);

    // Determine custom_url value
    let custom_url_val = payload.custom_url.clone().or_else(|| {
        payload.site_id.as_ref().map(|_| String::new())
    });

    let bookmark = sqlx::query_as::<_, BrowserBookmark>(
        r#"
        INSERT INTO browser_bookmarks (user_id, site_id, custom_url, custom_name, custom_icon_url, position)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
        "#
    )
    .bind(user_id)
    .bind(&payload.site_id)
    .bind(&custom_url_val)
    .bind(&payload.custom_name)
    .bind(&payload.custom_icon_url)
    .bind(max_pos + 1)
    .fetch_one(pool)
    .await;

    match bookmark {
        Ok(bookmark) => HttpResponse::Created().json(bookmark),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": format!("Failed to create bookmark: {}", e)
        }))
    }
}

pub async fn delete_bookmark(
    pool: &PgPool,
    user_id: Uuid,
    bookmark_id: Uuid
) -> HttpResponse {
    let result = sqlx::query(
        "DELETE FROM browser_bookmarks WHERE id = $1 AND user_id = $2"
    )
    .bind(bookmark_id)
    .bind(user_id)
    .execute(pool)
    .await;

    match result {
        Ok(_) => HttpResponse::NoContent().finish(),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": format!("Failed to delete bookmark: {}", e)
        }))
    }
}

pub async fn update_bookmark(
    pool: &PgPool,
    user_id: Uuid,
    bookmark_id: Uuid,
    payload: UpdateBookmarkPayload,
) -> HttpResponse {
    let url_trim = payload.custom_url.trim();
    let name_trim = payload.custom_name.trim();
    if url_trim.is_empty() {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "custom_url is required"
        }));
    }
    if name_trim.is_empty() {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "custom_name is required"
        }));
    }

    let site_match: Option<(Uuid,)> = sqlx::query_as(
        "SELECT id FROM browser_sites WHERE url = $1 LIMIT 1",
    )
    .bind(url_trim)
    .fetch_optional(pool)
    .await
    .unwrap_or(None);

    let (site_id, custom_url_stored): (Option<Uuid>, String) = match site_match {
        Some((id,)) => (Some(id), String::new()),
        None => (None, url_trim.to_string()),
    };

    let updated = sqlx::query_as::<_, BrowserBookmark>(
        r#"
        UPDATE browser_bookmarks SET
            site_id = $1,
            custom_url = $2,
            custom_name = $3,
            updated_at = NOW()
        WHERE id = $4 AND user_id = $5
        RETURNING *
        "#,
    )
    .bind(site_id)
    .bind(&custom_url_stored)
    .bind(name_trim)
    .bind(bookmark_id)
    .bind(user_id)
    .fetch_optional(pool)
    .await;

    match updated {
        Ok(Some(row)) => HttpResponse::Ok().json(row),
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({
            "error": "Bookmark not found"
        })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": format!("Failed to update bookmark: {}", e)
        })),
    }
}

pub async fn get_settings(
    pool: &PgPool,
    user_id: Uuid
) -> HttpResponse {
    let settings = sqlx::query_as::<_, BrowserSettings>(
        "SELECT * FROM browser_settings WHERE user_id = $1"
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await;

    match settings {
        Ok(Some(settings)) => HttpResponse::Ok().json(settings),
        Ok(None) => {
            // Create default settings
            let default = sqlx::query_as::<_, BrowserSettings>(
                r#"
                INSERT INTO browser_settings (user_id, homepage_url, search_engine, theme, show_bookmarks_bar, auto_play_media, block_popups)
                VALUES ($1, 'zeroday://home', 'zeroday', 'dark', TRUE, TRUE, TRUE)
                RETURNING *
                "#
            )
            .bind(user_id)
            .fetch_one(pool)
            .await;

            match default {
                Ok(settings) => HttpResponse::Ok().json(settings),
                Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
                    "error": format!("Failed to create default settings: {}", e)
                }))
            }
        }
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": format!("Failed to fetch settings: {}", e)
        }))
    }
}

pub async fn update_settings(
    pool: &PgPool,
    user_id: Uuid,
    payload: UpdateSettingsPayload
) -> HttpResponse {
    // Build dynamic update query
    let mut updates = Vec::new();
    if let Some(homepage_url) = &payload.homepage_url {
        updates.push(format!("homepage_url = '{}'", homepage_url.replace('\'', "''")));
    }
    if let Some(search_engine) = &payload.search_engine {
        updates.push(format!("search_engine = '{}'", search_engine.replace('\'', "''")));
    }
    if let Some(theme) = &payload.theme {
        updates.push(format!("theme = '{}'", theme.replace('\'', "''")));
    }
    if let Some(show_bookmarks_bar) = payload.show_bookmarks_bar {
        updates.push(format!("show_bookmarks_bar = {}", show_bookmarks_bar));
    }
    if let Some(auto_play_media) = payload.auto_play_media {
        updates.push(format!("auto_play_media = {}", auto_play_media));
    }
    if let Some(block_popups) = payload.block_popups {
        updates.push(format!("block_popups = {}", block_popups));
    }

    if updates.is_empty() {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "No fields to update"
        }));
    }

    let query = format!(
        "UPDATE browser_settings SET {} WHERE user_id = $1 RETURNING *",
        updates.join(", ")
    );

    let settings = sqlx::query_as::<_, BrowserSettings>(&query)
        .bind(user_id)
        .fetch_optional(pool)
        .await;

    match settings {
        Ok(Some(settings)) => HttpResponse::Ok().json(settings),
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({
            "error": "Settings not found"
        })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": format!("Failed to update settings: {}", e)
        }))
    }
}

pub async fn append_history(
    pool: &PgPool,
    user_id: Uuid,
    payload: AppendHistoryPayload,
) -> HttpResponse {
    let url_trim = payload.url.trim();
    if url_trim.is_empty() {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "url is required"
        }));
    }
    let url_stored = clamp_history_str(url_trim, 512);
    let title_stored = payload
        .title
        .as_ref()
        .map(|t| clamp_history_str(t.trim(), 512))
        .filter(|t| !t.is_empty());

    let row = sqlx::query_as::<_, BrowserHistory>(
        r#"
        INSERT INTO browser_history (user_id, url, title)
        VALUES ($1, $2, $3)
        RETURNING *
        "#,
    )
    .bind(user_id)
    .bind(&url_stored)
    .bind(title_stored.as_ref())
    .fetch_one(pool)
    .await;

    match row {
        Ok(h) => HttpResponse::Created().json(h),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": format!("Failed to save history: {}", e)
        })),
    }
}

pub async fn list_history(
    pool: &PgPool,
    user_id: Uuid,
    query: web::Query<HistoryListQuery>,
) -> HttpResponse {
    let limit = query.limit.unwrap_or(100).clamp(1, 500);
    let offset = query.offset.unwrap_or(0).max(0);

    let rows = sqlx::query_as::<_, BrowserHistory>(
        r#"
        SELECT * FROM browser_history
        WHERE user_id = $1
        ORDER BY visited_at DESC
        LIMIT $2 OFFSET $3
        "#,
    )
    .bind(user_id)
    .bind(limit)
    .bind(offset)
    .fetch_all(pool)
    .await;

    match rows {
        Ok(list) => HttpResponse::Ok().json(list),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": format!("Failed to list history: {}", e)
        })),
    }
}

pub async fn delete_history_entry(
    pool: &PgPool,
    user_id: Uuid,
    entry_id: Uuid,
) -> HttpResponse {
    let res = sqlx::query(
        "DELETE FROM browser_history WHERE id = $1 AND user_id = $2",
    )
    .bind(entry_id)
    .bind(user_id)
    .execute(pool)
    .await;

    match res {
        Ok(r) if r.rows_affected() > 0 => HttpResponse::NoContent().finish(),
        Ok(_) => HttpResponse::NotFound().json(serde_json::json!({
            "error": "History entry not found"
        })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": format!("Failed to delete history entry: {}", e)
        })),
    }
}

pub async fn clear_history(
    pool: &PgPool,
    user_id: Uuid,
    query: web::Query<ClearHistoryQuery>,
) -> HttpResponse {
    let scope = query.scope.to_lowercase();
    let result = if scope == "all" {
        sqlx::query("DELETE FROM browser_history WHERE user_id = $1")
            .bind(user_id)
            .execute(pool)
            .await
    } else if scope == "older_than" {
        let hours_total = match (query.days, query.hours) {
            (Some(d), _) if d > 0 => d.saturating_mul(24),
            (_, Some(h)) if h > 0 => h,
            _ => {
                return HttpResponse::BadRequest().json(serde_json::json!({
                    "error": "For older_than scope, provide positive hours or days"
                }));
            }
        };
        sqlx::query(
            r#"
            DELETE FROM browser_history
            WHERE user_id = $1
              AND visited_at < NOW() - ($2::bigint * INTERVAL '1 hour')
            "#,
        )
        .bind(user_id)
        .bind(i64::from(hours_total))
        .execute(pool)
        .await
    } else {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "scope must be \"all\" or \"older_than\""
        }));
    };

    match result {
        Ok(r) => HttpResponse::Ok().json(serde_json::json!({
            "deleted": r.rows_affected()
        })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": format!("Failed to clear history: {}", e)
        })),
    }
}
