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

pub async fn get_sites(pool: web::Data<PgPool>) -> HttpResponse {
    let sites = sqlx::query_as::<_, BrowserSite>(
        "SELECT * FROM browser_sites WHERE is_indexed = TRUE ORDER BY category, name"
    )
    .fetch_all(pool.get_ref())
    .await;

    match sites {
        Ok(sites) => HttpResponse::Ok().json(sites),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": format!("Failed to fetch sites: {}", e)
        }))
    }
}

pub async fn search_sites(
    pool: web::Data<PgPool>,
    query: web::Query<SearchQuery>
) -> HttpResponse {
    let search_term = format!("%{}%", query.q.to_lowercase());

    let sites = sqlx::query_as::<_, BrowserSite>(
        r#"
        SELECT DISTINCT bs.*
        FROM browser_sites bs
        WHERE bs.is_indexed = TRUE
        AND (
            LOWER(bs.name) LIKE $1
            OR LOWER(bs.description) LIKE $1
            OR LOWER(bs.category) LIKE $1
        )
        ORDER BY bs.name
        LIMIT 20
        "#
    )
    .bind(&search_term)
    .fetch_all(pool.get_ref())
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
    // Get max position
    let max_pos = sqlx::query_scalar::<_, Option<i32>>(
        "SELECT MAX(position) FROM browser_bookmarks WHERE user_id = $1"
    )
    .bind(user_id)
    .fetch_one(pool)
    .await
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
