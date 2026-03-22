use actix_cors::Cors;
use actix_web::{middleware::Logger, web, App, HttpRequest, HttpResponse, HttpServer, Responder};
use dotenvy::dotenv;
use log::info;
use serde::{Deserialize, Serialize};
use sqlx::{Postgres, QueryBuilder};
use sqlx::PgPool;
use std::env;
use std::path::Path;
use uuid::Uuid;
use zeroday_backend::{auth, browser, db, websocket, fs_online, sites, messenger, admin_http, subscription_http};
use zeroday_backend::auth::User as AuthUser;
use zeroday_backend::middleware::{RateLimiter, extract_client_ip};
use std::sync::Arc;
use tokio::sync::RwLock;

use zeroday_backend::AppState;

/// Каталог сайтов браузера (нужен зарегистрированный `web::Data<PgPool>`).
async fn browser_catalog_sites(pool: web::Data<PgPool>) -> impl Responder {
    browser::get_sites(pool.get_ref()).await
}

async fn browser_catalog_search(
    pool: web::Data<PgPool>,
    query: web::Query<browser::SearchQuery>,
) -> impl Responder {
    browser::search_sites(pool.get_ref(), query).await
}

async fn health() -> impl Responder {
    HttpResponse::Ok().json(serde_json::json!({ "ok": true }))
}

async fn debug_db(pool: web::Data<PgPool>) -> impl Responder {
    // Простая проверка подключения
    let result = sqlx::query_scalar::<_, i64>("SELECT 1")
        .fetch_one(pool.get_ref())
        .await;
    
    match result {
        Ok(val) => HttpResponse::Ok().json(serde_json::json!({
            "ok": true,
            "db_test": val
        })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "ok": false,
            "error": format!("DB error: {}", e)
        }))
    }
}


#[derive(Deserialize)]
struct RegisterPayload {
    username: String,
    email: String,
    password: String,
}

#[derive(Deserialize)]
struct LoginPayload {
    login: String,
    password: String,
}

#[derive(Deserialize)]
struct ChangePasswordPayload {
    current_password: String,
    new_password: String,
}

#[derive(Deserialize)]
struct BetaApplyPayload {
    email: String,
    source: String,
}

async fn beta_apply_http(state: web::Data<AppState>, payload: web::Json<BetaApplyPayload>) -> impl Responder {
    let result = sqlx::query(
        "INSERT INTO beta_applications (id, email, source, status, created_at) VALUES ($1, $2, $3, $4, NOW())"
    )
    .bind(Uuid::new_v4().to_string())
    .bind(&payload.email)
    .bind(&payload.source)
    .bind("pending")
    .execute(&state.pool)
    .await;

    match result {
        Ok(_) => HttpResponse::Ok().json(serde_json::json!({
            "ok": true
        })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "ok": false,
            "error": format!("Failed to submit application: {}", e)
        })),
    }
}

#[derive(Deserialize)]
struct CreateLotPayload {
    name: String,
    category: String,
    kind: String,
    description: String,
    price: i32,
    img: Option<String>,
}

#[derive(Deserialize)]
struct SendMessagePayload {
    text: String,
}

#[derive(Deserialize)]
struct MarketplaceQuery {
    q: Option<String>,
    category: Option<String>,
    sort: Option<String>,
    limit: Option<i64>,
    offset: Option<i64>,
}

#[derive(Clone, Copy)]
enum MarketplaceSort {
    Newest,
    PriceAsc,
    PriceDesc,
    Rating,
}

impl MarketplaceSort {
    fn from_query(value: Option<&str>) -> Self {
        match value.unwrap_or("newest") {
            "price_asc" => Self::PriceAsc,
            "price_desc" => Self::PriceDesc,
            "rating" => Self::Rating,
            _ => Self::Newest,
        }
    }
}

#[derive(Serialize, sqlx::FromRow)]
struct MarketplaceLotRow {
    id: Uuid,
    name: String,
    category: String,
    kind: String,
    description: String,
    price: i32,
    rating: f64,
    seller_user_id: Uuid,
    seller_name: String,
    img: Option<String>,
    created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Serialize)]
struct MarketplaceLotDto {
    id: String,
    name: String,
    category: String,
    kind: String,
    description: String,
    price: i32,
    rating: f64,
    seller_id: String,
    seller_name: String,
    img: String,
    created_at: i64,
}

#[derive(Serialize, sqlx::FromRow)]
struct MarketplaceThreadRow {
    id: Uuid,
    lot_id: Uuid,
    buyer_user_id: Uuid,
    seller_user_id: Uuid,
    status: String,
}

#[derive(Serialize, sqlx::FromRow)]
struct MarketplaceMessageRow {
    id: Uuid,
    from_user_id: Uuid,
    message_text: String,
    created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Serialize)]
struct MarketplaceThreadDto {
    id: String,
    lot_id: String,
    buyer_id: String,
    seller_id: String,
    status: String,
    messages: Vec<MarketplaceMessageDto>,
}

#[derive(Serialize)]
struct MarketplaceMessageDto {
    id: String,
    from_id: String,
    text: String,
    ts: i64,
}

#[derive(Serialize)]
struct MarketplacePageDto {
    lots: Vec<MarketplaceLotDto>,
    total: i64,
    limit: i64,
    offset: i64,
}

#[derive(Serialize, sqlx::FromRow)]
struct MarketplaceDealRow {
    thread_id: Uuid,
    status: String,
    buyer_user_id: Uuid,
    seller_user_id: Uuid,
    id: Uuid,
    name: String,
    category: String,
    kind: String,
    description: String,
    price: i32,
    rating: f64,
    seller_name: String,
    img: Option<String>,
    created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Serialize)]
struct MarketplaceDealDto {
    thread_id: String,
    status: String,
    role: String,
    lot: MarketplaceLotDto,
}

fn bearer_token(req: &HttpRequest) -> Option<&str> {
    let header = req.headers().get("Authorization")?.to_str().ok()?;
    header.strip_prefix("Bearer ")
}

/// Извлекает user_id (String) из JWT токена в запросе
fn user_id_from_request(req: &HttpRequest, jwt_secret: &str) -> Result<String, actix_web::Error> {
    use actix_web::error::ErrorUnauthorized;
    use zeroday_backend::auth;

    let token = bearer_token(req)
        .ok_or_else(|| ErrorUnauthorized("Missing Authorization header"))?;

    auth::decode_user_id_from_jwt(token, jwt_secret)
        .map_err(|_| ErrorUnauthorized("Invalid JWT token"))
}

async fn register_http(state: web::Data<AppState>, req: HttpRequest, payload: web::Json<RegisterPayload>) -> impl Responder {
    // Apply rate limiting based on client IP to prevent spam registration
    let client_ip = extract_client_ip(&req);
    if !state.rate_limiter.check(&client_ip).await {
        let retry_after = state.rate_limiter.reset_in(&client_ip).await.unwrap_or(60);
        return HttpResponse::TooManyRequests()
            .insert_header(("Retry-After", retry_after.to_string()))
            .json(serde_json::json!({
                "ok": false,
                "error": format!("Too many registration attempts. Please try again in {} seconds.", retry_after)
            }));
    }

    match auth::register_user(
        &state.pool,
        &state.jwt_secret,
        &payload.username,
        &payload.email,
        &payload.password,
    )
    .await
    {
        Ok(response) => HttpResponse::Ok().json(serde_json::json!({
            "ok": true,
            "token": response.token,
            "refresh_token": response.refresh_token,
            "user": response.user,
            "expires_in": response.expires_in
        })),
        Err(e) => HttpResponse::BadRequest().json(serde_json::json!({
            "ok": false,
            "error": e.to_string()
        })),
    }
}

async fn login_http(state: web::Data<AppState>, req: HttpRequest, payload: web::Json<LoginPayload>) -> impl Responder {
    // Apply rate limiting based on client IP
    let client_ip = extract_client_ip(&req);
    if !state.rate_limiter.check(&client_ip).await {
        let retry_after = state.rate_limiter.reset_in(&client_ip).await.unwrap_or(60);
        return HttpResponse::TooManyRequests()
            .insert_header(("Retry-After", retry_after.to_string()))
            .json(serde_json::json!({
                "ok": false,
                "error": format!("Too many login attempts. Please try again in {} seconds.", retry_after)
            }));
    }

    match auth::login_user(&state.pool, &state.jwt_secret, &payload.login, &payload.password, None, None).await {
        Ok(response) => HttpResponse::Ok().json(serde_json::json!({
            "ok": true,
            "token": response.token,
            "refresh_token": response.refresh_token,
            "user": response.user,
            "expires_in": response.expires_in
        })),
        Err(e) => HttpResponse::Unauthorized().json(serde_json::json!({
            "ok": false,
            "error": e.to_string()
        })),
    }
}

async fn me_http(state: web::Data<AppState>, req: HttpRequest) -> impl Responder {
    let user_id = match user_id_from_request(&req, &state.jwt_secret) {
        Ok(id) => id,
        Err(_) => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "ok": false,
                "error": "Unauthorized"
            }))
        }
    };

    let token = match bearer_token(&req) {
        Some(t) => t,
        None => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "ok": false,
                "error": "Unauthorized"
            }))
        }
    };

    let _ = user_id; // Decoded for validation before loading current user.
    match auth::authorize_user(&state.pool, &state.jwt_secret, token).await {
        Ok(user) => HttpResponse::Ok().json(serde_json::json!({ "ok": true, "user": user })),
        Err(_) => HttpResponse::Unauthorized().json(serde_json::json!({
            "ok": false,
            "error": "Unauthorized"
        })),
    }
}

async fn change_password_http(
    state: web::Data<AppState>,
    req: HttpRequest,
    payload: web::Json<ChangePasswordPayload>,
) -> impl Responder {
    let user_id = match user_id_from_request(&req, &state.jwt_secret) {
        Ok(id) => id,
        Err(_) => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "ok": false,
                "error": "Unauthorized"
            }))
        }
    };

    match auth::change_password(
        &state.pool,
        &user_id,
        &payload.current_password,
        &payload.new_password,
    )
    .await
    {
        Ok(()) => HttpResponse::Ok().json(serde_json::json!({ "ok": true })),
        Err(e) => HttpResponse::BadRequest().json(serde_json::json!({
            "ok": false,
            "error": e.to_string()
        })),
    }
}

fn lot_to_dto(row: MarketplaceLotRow) -> MarketplaceLotDto {
    MarketplaceLotDto {
        id: row.id.to_string(),
        name: row.name,
        category: row.category,
        kind: row.kind,
        description: row.description,
        price: row.price,
        rating: row.rating,
        seller_id: row.seller_user_id.to_string(),
        seller_name: row.seller_name,
        img: row.img.unwrap_or_else(|| "/zd-web-builder.svg".to_string()),
        created_at: row.created_at.timestamp_millis(),
    }
}

fn sanitize_marketplace_query(
    query: &MarketplaceQuery,
) -> (Option<String>, Option<String>, MarketplaceSort, i64, i64) {
    let q = query.q.as_ref().map(|v| v.trim().to_string()).filter(|v| !v.is_empty());
    let category = query.category.as_ref().map(|v| v.trim().to_string()).filter(|v| !v.is_empty());
    let sort = MarketplaceSort::from_query(query.sort.as_deref().map(str::trim));
    let limit = query.limit.unwrap_or(12).clamp(1, 50);
    let offset = query.offset.unwrap_or(0).max(0);
    (q, category, sort, limit, offset)
}

async fn list_lots_http(state: web::Data<AppState>, query: web::Query<MarketplaceQuery>) -> impl Responder {
    let (q, category, sort, limit, offset) = sanitize_marketplace_query(&query);

    let mut sql = QueryBuilder::<Postgres>::new(
        r#"
        SELECT
          l.id, l.name, l.category, l.kind, l.description, l.price, CAST(l.rating AS FLOAT8) AS rating,
          l.seller_user_id,
          u.username AS seller_name,
          l.img, l.created_at
        FROM marketplace_lots l
        JOIN users u ON u.id = l.seller_user_id
        WHERE 1=1
        "#,
    );
    if let Some(category) = &category {
        sql.push(" AND l.category = ").push_bind(category);
    }
    if let Some(q) = &q {
        let like = format!("%{}%", q);
        sql.push(" AND (l.name ILIKE ")
            .push_bind(like.clone())
            .push(" OR l.description ILIKE ")
            .push_bind(like.clone())
            .push(" OR u.username ILIKE ")
            .push_bind(like)
            .push(")");
    }
    match sort {
        MarketplaceSort::Newest => sql.push(" ORDER BY l.created_at DESC "),
        MarketplaceSort::PriceAsc => sql.push(" ORDER BY l.price ASC, l.created_at DESC "),
        MarketplaceSort::PriceDesc => sql.push(" ORDER BY l.price DESC, l.created_at DESC "),
        MarketplaceSort::Rating => sql.push(" ORDER BY l.rating DESC, l.created_at DESC "),
    };
    sql.push(" LIMIT ").push_bind(limit);
    sql.push(" OFFSET ").push_bind(offset);

    let rows = sql.build_query_as::<MarketplaceLotRow>().fetch_all(&state.pool).await;

    let mut count_sql = QueryBuilder::<Postgres>::new(
        r#"
        SELECT COUNT(*)
        FROM marketplace_lots l
        JOIN users u ON u.id = l.seller_user_id
        WHERE 1=1
        "#,
    );
    if let Some(category) = &category {
        count_sql.push(" AND l.category = ").push_bind(category);
    }
    if let Some(q) = &q {
        let like = format!("%{}%", q);
        count_sql
            .push(" AND (l.name ILIKE ")
            .push_bind(like.clone())
            .push(" OR l.description ILIKE ")
            .push_bind(like.clone())
            .push(" OR u.username ILIKE ")
            .push_bind(like)
            .push(")");
    }
    let total = count_sql
        .build_query_scalar::<i64>()
        .fetch_one(&state.pool)
        .await
        .map_err(|e| {
            log::warn!("Failed to fetch total lots count: {}", e);
            e
        })
        .unwrap_or(0);

    match rows {
        Ok(rows) => {
            let lots: Vec<MarketplaceLotDto> = rows.into_iter().map(lot_to_dto).collect();
            let page = MarketplacePageDto {
                lots,
                total,
                limit,
                offset,
            };
            HttpResponse::Ok().json(serde_json::json!({ "ok": true, "page": page }))
        }
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "ok": false,
            "error": format!("Failed to load lots: {e}")
        })),
    }
}

async fn my_lots_http(
    state: web::Data<AppState>,
    req: HttpRequest,
    query: web::Query<MarketplaceQuery>,
) -> impl Responder {
    let user_id = match user_id_from_request(&req, &state.jwt_secret) {
        Ok(id) => id,
        Err(_) => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "ok": false, "error": "Unauthorized"
            }))
        }
    };
    let user_uuid = match Uuid::parse_str(&user_id) {
        Ok(v) => v,
        Err(_) => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "ok": false, "error": "Invalid user id"
            }))
        }
    };
    let (q, category, sort, limit, offset) = sanitize_marketplace_query(&query);

    let mut sql = QueryBuilder::<Postgres>::new(
        r#"
        SELECT
          l.id, l.name, l.category, l.kind, l.description, l.price, CAST(l.rating AS FLOAT8) AS rating,
          l.seller_user_id,
          u.username AS seller_name,
          l.img, l.created_at
        FROM marketplace_lots l
        JOIN users u ON u.id = l.seller_user_id
        WHERE l.seller_user_id = 
        "#,
    );
    sql.push_bind(user_uuid);
    if let Some(category) = &category {
        sql.push(" AND l.category = ").push_bind(category);
    }
    if let Some(q) = &q {
        let like = format!("%{}%", q);
        sql.push(" AND (l.name ILIKE ")
            .push_bind(like.clone())
            .push(" OR l.description ILIKE ")
            .push_bind(like)
            .push(")");
    }
    match sort {
        MarketplaceSort::Newest => sql.push(" ORDER BY l.created_at DESC "),
        MarketplaceSort::PriceAsc => sql.push(" ORDER BY l.price ASC, l.created_at DESC "),
        MarketplaceSort::PriceDesc => sql.push(" ORDER BY l.price DESC, l.created_at DESC "),
        MarketplaceSort::Rating => sql.push(" ORDER BY l.rating DESC, l.created_at DESC "),
    };
    sql.push(" LIMIT ").push_bind(limit);
    sql.push(" OFFSET ").push_bind(offset);

    let rows = sql.build_query_as::<MarketplaceLotRow>().fetch_all(&state.pool).await;

    let mut count_sql = QueryBuilder::<Postgres>::new("SELECT COUNT(*) FROM marketplace_lots l WHERE l.seller_user_id = ");
    count_sql.push_bind(user_uuid);
    if let Some(category) = &category {
        count_sql.push(" AND l.category = ").push_bind(category);
    }
    if let Some(q) = &q {
        let like = format!("%{}%", q);
        count_sql
            .push(" AND (l.name ILIKE ")
            .push_bind(like.clone())
            .push(" OR l.description ILIKE ")
            .push_bind(like)
            .push(")");
    }
    let total = count_sql
        .build_query_scalar::<i64>()
        .fetch_one(&state.pool)
        .await
        .map_err(|e| {
            log::warn!("Failed to fetch my lots count for user {}: {}", user_id, e);
            e
        })
        .unwrap_or(0);

    match rows {
        Ok(rows) => {
            let lots = rows.into_iter().map(lot_to_dto).collect::<Vec<_>>();
            let page = MarketplacePageDto {
                lots,
                total,
                limit,
                offset,
            };
            HttpResponse::Ok().json(serde_json::json!({ "ok": true, "page": page }))
        }
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "ok": false,
            "error": format!("Failed to load my lots: {e}")
        })),
    }
}

async fn my_deals_http(
    state: web::Data<AppState>,
    req: HttpRequest,
    query: web::Query<MarketplaceQuery>,
) -> impl Responder {
    let user_id = match user_id_from_request(&req, &state.jwt_secret) {
        Ok(id) => id,
        Err(_) => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "ok": false, "error": "Unauthorized"
            }))
        }
    };
    let user_uuid = match Uuid::parse_str(&user_id) {
        Ok(v) => v,
        Err(_) => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "ok": false, "error": "Invalid user id"
            }))
        }
    };
    let (q, category, sort, limit, offset) = sanitize_marketplace_query(&query);

    let mut sql = QueryBuilder::<Postgres>::new(
        r#"
        SELECT
          t.id AS thread_id, t.status, t.buyer_user_id, t.seller_user_id,
          l.id, l.name, l.category, l.kind, l.description, l.price, CAST(l.rating AS FLOAT8) AS rating,
          u.username AS seller_name, l.img, l.created_at
        FROM marketplace_threads t
        JOIN marketplace_lots l ON l.id = t.lot_id
        JOIN users u ON u.id = l.seller_user_id
        WHERE (t.buyer_user_id = 
        "#,
    );
    sql.push_bind(user_uuid)
        .push(" OR t.seller_user_id = ")
        .push_bind(user_uuid)
        .push(")");
    if let Some(category) = &category {
        sql.push(" AND l.category = ").push_bind(category);
    }
    if let Some(q) = &q {
        let like = format!("%{}%", q);
        sql.push(" AND (l.name ILIKE ")
            .push_bind(like.clone())
            .push(" OR l.description ILIKE ")
            .push_bind(like.clone())
            .push(" OR u.username ILIKE ")
            .push_bind(like)
            .push(")");
    }
    match sort {
        MarketplaceSort::Newest => sql.push(" ORDER BY t.created_at DESC "),
        MarketplaceSort::PriceAsc => sql.push(" ORDER BY l.price ASC, t.created_at DESC "),
        MarketplaceSort::PriceDesc => sql.push(" ORDER BY l.price DESC, t.created_at DESC "),
        MarketplaceSort::Rating => sql.push(" ORDER BY l.rating DESC, t.created_at DESC "),
    };
    sql.push(" LIMIT ").push_bind(limit);
    sql.push(" OFFSET ").push_bind(offset);

    let rows = sql.build_query_as::<MarketplaceDealRow>().fetch_all(&state.pool).await;

    let mut count_sql = QueryBuilder::<Postgres>::new(
        "SELECT COUNT(*) FROM marketplace_threads t JOIN marketplace_lots l ON l.id=t.lot_id JOIN users u ON u.id=l.seller_user_id WHERE (t.buyer_user_id = ",
    );
    count_sql
        .push_bind(user_uuid)
        .push(" OR t.seller_user_id = ")
        .push_bind(user_uuid)
        .push(")");
    if let Some(category) = &category {
        count_sql.push(" AND l.category = ").push_bind(category);
    }
    if let Some(q) = &q {
        let like = format!("%{}%", q);
        count_sql
            .push(" AND (l.name ILIKE ")
            .push_bind(like.clone())
            .push(" OR l.description ILIKE ")
            .push_bind(like.clone())
            .push(" OR u.username ILIKE ")
            .push_bind(like)
            .push(")");
    }
    let total = count_sql
        .build_query_scalar::<i64>()
        .fetch_one(&state.pool)
        .await
        .map_err(|e| {
            log::warn!("Failed to fetch deals count for user {}: {}", user_id, e);
            e
        })
        .unwrap_or(0);

    match rows {
        Ok(rows) => {
            let deals = rows
                .into_iter()
                .map(|r| MarketplaceDealDto {
                    thread_id: r.thread_id.to_string(),
                    status: r.status,
                    role: if r.seller_user_id == user_uuid {
                        "seller".to_string()
                    } else {
                        "buyer".to_string()
                    },
                    lot: MarketplaceLotDto {
                        id: r.id.to_string(),
                        name: r.name,
                        category: r.category,
                        kind: r.kind,
                        description: r.description,
                        price: r.price,
                        rating: r.rating,
                        seller_id: r.seller_user_id.to_string(),
                        seller_name: r.seller_name,
                        img: r.img.unwrap_or_else(|| "/zd-web-builder.svg".to_string()),
                        created_at: r.created_at.timestamp_millis(),
                    },
                })
                .collect::<Vec<_>>();

            HttpResponse::Ok().json(serde_json::json!({
                "ok": true,
                "page": {
                    "deals": deals,
                    "total": total,
                    "limit": limit,
                    "offset": offset
                }
            }))
        }
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "ok": false,
            "error": format!("Failed to load deals: {e}")
        })),
    }
}

async fn create_lot_http(
    state: web::Data<AppState>,
    req: HttpRequest,
    payload: web::Json<CreateLotPayload>,
) -> impl Responder {
    let user_id = match user_id_from_request(&req, &state.jwt_secret) {
        Ok(id) => id,
        Err(_) => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "ok": false, "error": "Unauthorized"
            }))
        }
    };

    if payload.name.trim().is_empty() || payload.description.trim().is_empty() || payload.price <= 0 {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "ok": false, "error": "Invalid lot payload"
        }));
    }

    let seller_uuid = match Uuid::parse_str(&user_id) {
        Ok(v) => v,
        Err(_) => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "ok": false, "error": "Invalid user id"
            }))
        }
    };

    let row = sqlx::query_as::<_, MarketplaceLotRow>(
        r#"
        INSERT INTO marketplace_lots (seller_user_id, name, category, kind, description, price, img)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, name, category, kind, description, price, CAST(rating AS FLOAT8) AS rating, seller_user_id,
          (SELECT username FROM users WHERE id = seller_user_id) AS seller_name,
          img, created_at
        "#,
    )
    .bind(seller_uuid)
    .bind(payload.name.trim())
    .bind(payload.category.trim())
    .bind(payload.kind.trim())
    .bind(payload.description.trim())
    .bind(payload.price)
    .bind(payload.img.clone())
    .fetch_one(&state.pool)
    .await;

    match row {
        Ok(row) => HttpResponse::Ok().json(serde_json::json!({
            "ok": true,
            "lot": lot_to_dto(row)
        })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "ok": false, "error": format!("Failed to create lot: {e}")
        })),
    }
}

async fn request_deal_http(
    state: web::Data<AppState>,
    req: HttpRequest,
    lot_id: web::Path<String>,
) -> impl Responder {
    let user_id = match user_id_from_request(&req, &state.jwt_secret) {
        Ok(id) => id,
        Err(_) => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "ok": false, "error": "Unauthorized"
            }))
        }
    };

    let lot_uuid = match Uuid::parse_str(&lot_id.into_inner()) {
        Ok(v) => v,
        Err(_) => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "ok": false, "error": "Invalid lot id"
            }))
        }
    };
    let buyer_uuid = match Uuid::parse_str(&user_id) {
        Ok(v) => v,
        Err(_) => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "ok": false, "error": "Invalid user id"
            }))
        }
    };

    let seller_row = sqlx::query_as::<_, (Uuid,)>(
        "SELECT seller_user_id FROM marketplace_lots WHERE id = $1",
    )
    .bind(lot_uuid)
    .fetch_optional(&state.pool)
    .await;

    let seller_uuid = match seller_row {
        Ok(Some((id,))) => id,
        Ok(None) => {
            return HttpResponse::NotFound().json(serde_json::json!({
                "ok": false, "error": "Lot not found"
            }))
        }
        Err(e) => {
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "ok": false, "error": format!("Failed to load lot: {e}")
            }))
        }
    };

    if seller_uuid == buyer_uuid {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "ok": false, "error": "Seller cannot request own lot"
        }));
    }

    let _ = sqlx::query(
        r#"
        INSERT INTO marketplace_threads (lot_id, buyer_user_id, seller_user_id, status)
        VALUES ($1, $2, $3, 'requested')
        ON CONFLICT (lot_id, buyer_user_id) DO NOTHING
        "#,
    )
    .bind(lot_uuid)
    .bind(buyer_uuid)
    .bind(seller_uuid)
    .execute(&state.pool)
    .await;

    let _ = sqlx::query(
        r#"
        INSERT INTO marketplace_messages (thread_id, from_user_id, message_text)
        SELECT t.id, $3, 'Запрос сделки создан. Обсудим детали здесь.'
        FROM marketplace_threads t
        WHERE t.lot_id = $1 AND t.buyer_user_id = $2
        AND NOT EXISTS (
            SELECT 1 FROM marketplace_messages m WHERE m.thread_id = t.id
        )
        "#,
    )
    .bind(lot_uuid)
    .bind(buyer_uuid)
    .bind(buyer_uuid)
    .execute(&state.pool)
    .await;

    HttpResponse::Ok().json(serde_json::json!({ "ok": true }))
}

async fn get_thread_http(
    state: web::Data<AppState>,
    req: HttpRequest,
    lot_id: web::Path<String>,
) -> impl Responder {
    let user_id = match user_id_from_request(&req, &state.jwt_secret) {
        Ok(id) => id,
        Err(_) => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "ok": false, "error": "Unauthorized"
            }))
        }
    };
    let lot_uuid = match Uuid::parse_str(&lot_id.into_inner()) {
        Ok(v) => v,
        Err(_) => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "ok": false, "error": "Invalid lot id"
            }))
        }
    };
    let user_uuid = match Uuid::parse_str(&user_id) {
        Ok(v) => v,
        Err(_) => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "ok": false, "error": "Invalid user id"
            }))
        }
    };

    let thread = sqlx::query_as::<_, MarketplaceThreadRow>(
        r#"
        SELECT id, lot_id, buyer_user_id, seller_user_id, status
        FROM marketplace_threads
        WHERE lot_id = $1 AND (buyer_user_id = $2 OR seller_user_id = $2)
        LIMIT 1
        "#,
    )
    .bind(lot_uuid)
    .bind(user_uuid)
    .fetch_optional(&state.pool)
    .await;

    let thread = match thread {
        Ok(Some(t)) => t,
        Ok(None) => return HttpResponse::Ok().json(serde_json::json!({ "ok": true, "thread": null })),
        Err(e) => {
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "ok": false, "error": format!("Failed to load thread: {e}")
            }))
        }
    };

    let messages = sqlx::query_as::<_, MarketplaceMessageRow>(
        r#"
        SELECT id, from_user_id, message_text, created_at
        FROM marketplace_messages
        WHERE thread_id = $1
        ORDER BY created_at ASC
        "#,
    )
    .bind(thread.id)
    .fetch_all(&state.pool)
    .await
    .unwrap_or_default();

    let messages = messages
        .into_iter()
        .map(|m| MarketplaceMessageDto {
            id: m.id.to_string(),
            from_id: m.from_user_id.to_string(),
            text: m.message_text,
            ts: m.created_at.timestamp_millis(),
        })
        .collect::<Vec<_>>();

    let dto = MarketplaceThreadDto {
        id: thread.id.to_string(),
        lot_id: thread.lot_id.to_string(),
        buyer_id: thread.buyer_user_id.to_string(),
        seller_id: thread.seller_user_id.to_string(),
        status: thread.status,
        messages,
    };

    HttpResponse::Ok().json(serde_json::json!({ "ok": true, "thread": dto }))
}

// ==================== File System HTTP Handlers ====================

async fn fs_list_http(
    pool: web::Data<PgPool>,
    req: HttpRequest,
    state: web::Data<AppState>,
    query: web::Query<fs_online::FsListQuery>,
) -> impl Responder {
    let user_id = match user_id_from_request(&req, &state.jwt_secret) {
        Ok(id) => id,
        Err(e) => return HttpResponse::Unauthorized().json(serde_json::json!({ "ok": false, "error": e.to_string() }))
    };
    fs_online::fs_list(pool, &user_id, query).await
}

async fn fs_create_http(
    pool: web::Data<PgPool>,
    req: HttpRequest,
    state: web::Data<AppState>,
    payload: web::Json<fs_online::FsCreateRequest>,
) -> impl Responder {
    let user_id = match user_id_from_request(&req, &state.jwt_secret) {
        Ok(id) => id,
        Err(e) => return HttpResponse::Unauthorized().json(serde_json::json!({ "ok": false, "error": e.to_string() }))
    };
    fs_online::fs_create(pool, &user_id, payload).await
}

async fn fs_delete_http(
    pool: web::Data<PgPool>,
    req: HttpRequest,
    state: web::Data<AppState>,
    payload: web::Json<fs_online::FsDeleteRequest>,
) -> impl Responder {
    let user_id = match user_id_from_request(&req, &state.jwt_secret) {
        Ok(id) => id,
        Err(e) => return HttpResponse::Unauthorized().json(serde_json::json!({ "ok": false, "error": e.to_string() }))
    };
    fs_online::fs_delete(pool, &user_id, payload).await
}

async fn fs_move_http(
    pool: web::Data<PgPool>,
    req: HttpRequest,
    state: web::Data<AppState>,
    payload: web::Json<fs_online::FsMoveRequest>,
) -> impl Responder {
    let user_id = match user_id_from_request(&req, &state.jwt_secret) {
        Ok(id) => id,
        Err(e) => return HttpResponse::Unauthorized().json(serde_json::json!({ "ok": false, "error": e.to_string() }))
    };
    fs_online::fs_move(pool, &user_id, payload).await
}

async fn fs_read_http(
    pool: web::Data<PgPool>,
    req: HttpRequest,
    state: web::Data<AppState>,
    path: web::Path<String>,
) -> impl Responder {
    let user_id = match user_id_from_request(&req, &state.jwt_secret) {
        Ok(id) => id,
        Err(_e) => return HttpResponse::Unauthorized().finish()
    };
    fs_online::fs_read_text(pool, &user_id, path).await
}

async fn fs_write_http(
    pool: web::Data<PgPool>,
    req: HttpRequest,
    state: web::Data<AppState>,
    payload: web::Json<fs_online::FsCreateRequest>,
) -> impl Responder {
    let user_id = match user_id_from_request(&req, &state.jwt_secret) {
        Ok(id) => id,
        Err(e) => return HttpResponse::Unauthorized().json(serde_json::json!({ "ok": false, "error": e.to_string() }))
    };
    fs_online::fs_write_text(pool, &user_id, payload).await
}

// Browser API handlers
async fn get_bookmarks(
    state: web::Data<AppState>,
    req: HttpRequest,
) -> HttpResponse {
    let user_id = match user_id_from_request(&req, &state.jwt_secret) {
        Ok(id) => id,
        Err(_) => return HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Unauthorized"
        }))
    };
    let user_uuid = match Uuid::parse_str(&user_id) {
        Ok(v) => v,
        Err(_) => return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Invalid user id"
        }))
    };
    browser::get_bookmarks(&state.pool, user_uuid).await
}

async fn create_bookmark(
    state: web::Data<AppState>,
    req: HttpRequest,
    payload: web::Json<browser::CreateBookmarkPayload>,
) -> HttpResponse {
    let user_id = match user_id_from_request(&req, &state.jwt_secret) {
        Ok(id) => id,
        Err(_) => return HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Unauthorized"
        }))
    };
    let user_uuid = match Uuid::parse_str(&user_id) {
        Ok(v) => v,
        Err(_) => return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Invalid user id"
        }))
    };
    browser::create_bookmark(&state.pool, user_uuid, payload.into_inner()).await
}

async fn delete_bookmark(
    state: web::Data<AppState>,
    req: HttpRequest,
    bookmark_id: web::Path<Uuid>,
) -> HttpResponse {
    let user_id = match user_id_from_request(&req, &state.jwt_secret) {
        Ok(id) => id,
        Err(_) => return HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Unauthorized"
        }))
    };
    let user_uuid = match Uuid::parse_str(&user_id) {
        Ok(v) => v,
        Err(_) => return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Invalid user id"
        }))
    };
    browser::delete_bookmark(&state.pool, user_uuid, bookmark_id.into_inner()).await
}

async fn update_bookmark_http(
    state: web::Data<AppState>,
    req: HttpRequest,
    bookmark_id: web::Path<Uuid>,
    payload: web::Json<browser::UpdateBookmarkPayload>,
) -> HttpResponse {
    let user_id = match user_id_from_request(&req, &state.jwt_secret) {
        Ok(id) => id,
        Err(_) => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "error": "Unauthorized"
            }))
        }
    };
    let user_uuid = match Uuid::parse_str(&user_id) {
        Ok(v) => v,
        Err(_) => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "error": "Invalid user id"
            }))
        }
    };
    browser::update_bookmark(
        &state.pool,
        user_uuid,
        bookmark_id.into_inner(),
        payload.into_inner(),
    )
    .await
}

async fn get_settings(
    state: web::Data<AppState>,
    req: HttpRequest,
) -> HttpResponse {
    let user_id = match user_id_from_request(&req, &state.jwt_secret) {
        Ok(id) => id,
        Err(_) => return HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Unauthorized"
        }))
    };
    let user_uuid = match Uuid::parse_str(&user_id) {
        Ok(v) => v,
        Err(_) => return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Invalid user id"
        }))
    };
    browser::get_settings(&state.pool, user_uuid).await
}

async fn update_settings(
    state: web::Data<AppState>,
    req: HttpRequest,
    payload: web::Json<browser::UpdateSettingsPayload>,
) -> HttpResponse {
    let user_id = match user_id_from_request(&req, &state.jwt_secret) {
        Ok(id) => id,
        Err(_) => return HttpResponse::Unauthorized().json(serde_json::json!({
            "error": "Unauthorized"
        }))
    };
    let user_uuid = match Uuid::parse_str(&user_id) {
        Ok(v) => v,
        Err(_) => return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "Invalid user id"
        }))
    };
    browser::update_settings(&state.pool, user_uuid, payload.into_inner()).await
}

async fn append_history_http(
    state: web::Data<AppState>,
    req: HttpRequest,
    payload: web::Json<browser::AppendHistoryPayload>,
) -> HttpResponse {
    let user_id = match user_id_from_request(&req, &state.jwt_secret) {
        Ok(id) => id,
        Err(_) => {
            return HttpResponse::Unauthorized().json(serde_json::json!({ "error": "Unauthorized" }))
        }
    };
    let user_uuid = match Uuid::parse_str(&user_id) {
        Ok(v) => v,
        Err(_) => {
            return HttpResponse::BadRequest().json(serde_json::json!({ "error": "Invalid user id" }))
        }
    };
    browser::append_history(&state.pool, user_uuid, payload.into_inner()).await
}

async fn list_history_http(
    state: web::Data<AppState>,
    req: HttpRequest,
    query: web::Query<browser::HistoryListQuery>,
) -> HttpResponse {
    let user_id = match user_id_from_request(&req, &state.jwt_secret) {
        Ok(id) => id,
        Err(_) => {
            return HttpResponse::Unauthorized().json(serde_json::json!({ "error": "Unauthorized" }))
        }
    };
    let user_uuid = match Uuid::parse_str(&user_id) {
        Ok(v) => v,
        Err(_) => {
            return HttpResponse::BadRequest().json(serde_json::json!({ "error": "Invalid user id" }))
        }
    };
    browser::list_history(&state.pool, user_uuid, query).await
}

async fn delete_history_entry_http(
    state: web::Data<AppState>,
    req: HttpRequest,
    entry_id: web::Path<Uuid>,
) -> HttpResponse {
    let user_id = match user_id_from_request(&req, &state.jwt_secret) {
        Ok(id) => id,
        Err(_) => {
            return HttpResponse::Unauthorized().json(serde_json::json!({ "error": "Unauthorized" }))
        }
    };
    let user_uuid = match Uuid::parse_str(&user_id) {
        Ok(v) => v,
        Err(_) => {
            return HttpResponse::BadRequest().json(serde_json::json!({ "error": "Invalid user id" }))
        }
    };
    browser::delete_history_entry(&state.pool, user_uuid, entry_id.into_inner()).await
}

async fn clear_history_http(
    state: web::Data<AppState>,
    req: HttpRequest,
    query: web::Query<browser::ClearHistoryQuery>,
) -> HttpResponse {
    let user_id = match user_id_from_request(&req, &state.jwt_secret) {
        Ok(id) => id,
        Err(_) => {
            return HttpResponse::Unauthorized().json(serde_json::json!({ "error": "Unauthorized" }))
        }
    };
    let user_uuid = match Uuid::parse_str(&user_id) {
        Ok(v) => v,
        Err(_) => {
            return HttpResponse::BadRequest().json(serde_json::json!({ "error": "Invalid user id" }))
        }
    };
    browser::clear_history(&state.pool, user_uuid, query).await
}

// Sites API handlers
async fn get_sites_list() -> impl Responder {
    let sites = sites::get_all_sites();
    HttpResponse::Ok().json(serde_json::json!({
        "ok": true,
        "sites": sites
    }))
}

async fn create_site_http(payload: web::Json<CreateSitePayload>) -> impl Responder {
    let name = payload.name.trim().to_lowercase();
    
    if name.is_empty() || name.len() > 50 {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "ok": false,
            "error": "Invalid site name"
        }));
    }
    
    match sites::create_site(&name) {
        Ok(site) => HttpResponse::Ok().json(serde_json::json!({
            "ok": true,
            "site": site
        })),
        Err(e) => HttpResponse::BadRequest().json(serde_json::json!({
            "ok": false,
            "error": e.to_string()
        })),
    }
}

async fn delete_site_http(site_name: web::Path<String>) -> impl Responder {
    let name = site_name.trim().to_lowercase();
    
    match sites::delete_site(&name) {
        Ok(()) => HttpResponse::Ok().json(serde_json::json!({
            "ok": true
        })),
        Err(e) => HttpResponse::BadRequest().json(serde_json::json!({
            "ok": false,
            "error": e.to_string()
        })),
    }
}

async fn list_site_files_http(site_name: web::Path<String>) -> impl Responder {
    let name = site_name.trim().to_lowercase();
    
    match sites::list_site_files(&name) {
        Ok(files) => HttpResponse::Ok().json(serde_json::json!({
            "ok": true,
            "files": files
        })),
        Err(e) => HttpResponse::NotFound().json(serde_json::json!({
            "ok": false,
            "error": e.to_string()
        })),
    }
}

async fn get_site_file_http(
    site_name: web::Path<(String, String)>,
) -> impl Responder {
    let (name, file_path) = site_name.into_inner();
    let name = name.trim().to_lowercase();
    
    match sites::get_site_file(&name, &file_path) {
        Some(content) => {
            let mime = mime_guess::from_path(&file_path).first_or_octet_stream();
            HttpResponse::Ok()
                .content_type(mime.to_string())
                .body(content)
        },
        None => HttpResponse::NotFound().finish(),
    }
}

async fn upload_site_file_http(
    site_name: web::Path<String>,
    payload: web::Bytes,
) -> impl Responder {
    let name = site_name.trim().to_lowercase();
    
    // Для простоты сохраняем как index.html
    // В будущем можно парсить multipart для загрузки с именем файла
    match sites::upload_site_file(&name, "uploaded_file.bin", &payload) {
        Ok(()) => HttpResponse::Ok().json(serde_json::json!({
            "ok": true
        })),
        Err(e) => HttpResponse::BadRequest().json(serde_json::json!({
            "ok": false,
            "error": e.to_string()
        })),
    }
}

async fn delete_site_file_http(
    site_name: web::Path<(String, String)>,
) -> impl Responder {
    let (name, file_path) = site_name.into_inner();
    let name = name.trim().to_lowercase();
    
    match sites::delete_site_file(&name, &file_path) {
        Ok(()) => HttpResponse::Ok().json(serde_json::json!({
            "ok": true
        })),
        Err(e) => HttpResponse::NotFound().json(serde_json::json!({
            "ok": false,
            "error": e.to_string()
        })),
    }
}

#[derive(Deserialize)]
struct CreateSitePayload {
    name: String,
}

// ==================== Messenger HTTP API handlers ====================

async fn get_messenger_profile_http(
    state: web::Data<AppState>,
    req: HttpRequest,
) -> impl Responder {
    let user_id = match user_id_from_request(&req, &state.jwt_secret) {
        Ok(id) => id,
        Err(_) => return HttpResponse::Unauthorized().json(serde_json::json!({
            "ok": false, "error": "Unauthorized"
        }))
    };
    
    match messenger::get_messenger_profile(&state.pool, &user_id).await {
        Ok(Some(profile)) => HttpResponse::Ok().json(serde_json::json!({
            "ok": true,
            "profile": profile
        })),
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({
            "ok": false,
            "error": "Profile not found"
        })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "ok": false,
            "error": e.to_string()
        })),
    }
}

async fn setup_messenger_profile_http(
    state: web::Data<AppState>,
    req: HttpRequest,
    payload: web::Json<SetupProfilePayload>,
) -> impl Responder {
    let user_id = match user_id_from_request(&req, &state.jwt_secret) {
        Ok(id) => id,
        Err(_) => return HttpResponse::Unauthorized().json(serde_json::json!({
            "ok": false, "error": "Unauthorized"
        }))
    };
    
    match messenger::setup_messenger_profile(
        &state.pool,
        &user_id,
        &payload.messenger_id,
        &payload.display_name,
        payload.about.as_deref(),
    ).await {
        Ok(profile) => HttpResponse::Ok().json(serde_json::json!({
            "ok": true,
            "profile": profile
        })),
        Err(e) => HttpResponse::BadRequest().json(serde_json::json!({
            "ok": false,
            "error": e.to_string()
        })),
    }
}

async fn update_messenger_profile_http(
    state: web::Data<AppState>,
    req: HttpRequest,
    payload: web::Json<UpdateProfilePayload>,
) -> impl Responder {
    let user_id = match user_id_from_request(&req, &state.jwt_secret) {
        Ok(id) => id,
        Err(_) => return HttpResponse::Unauthorized().json(serde_json::json!({
            "ok": false, "error": "Unauthorized"
        }))
    };
    
    match messenger::update_messenger_profile(
        &state.pool,
        &user_id,
        payload.display_name.as_deref(),
        payload.avatar_url.as_deref(),
        payload.about.as_deref(),
    ).await {
        Ok(profile) => HttpResponse::Ok().json(serde_json::json!({
            "ok": true,
            "profile": profile
        })),
        Err(e) => HttpResponse::BadRequest().json(serde_json::json!({
            "ok": false,
            "error": e.to_string()
        })),
    }
}

async fn search_users_http(
    state: web::Data<AppState>,
    req: HttpRequest,
    query: web::Query<SearchUsersQuery>,
) -> impl Responder {
    let user_id = match user_id_from_request(&req, &state.jwt_secret) {
        Ok(id) => id,
        Err(_) => return HttpResponse::Unauthorized().json(serde_json::json!({
            "ok": false, "error": "Unauthorized"
        }))
    };
    
    match messenger::search_users(&state.pool, &query.q, &user_id).await {
        Ok(users) => HttpResponse::Ok().json(serde_json::json!({
            "ok": true,
            "users": users
        })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "ok": false,
            "error": e.to_string()
        })),
    }
}

async fn send_friend_request_http(
    state: web::Data<AppState>,
    req: HttpRequest,
    payload: web::Json<SendFriendRequestPayload>,
) -> impl Responder {
    let user_id = match user_id_from_request(&req, &state.jwt_secret) {
        Ok(id) => id,
        Err(_) => return HttpResponse::Unauthorized().json(serde_json::json!({
            "ok": false, "error": "Unauthorized"
        }))
    };
    
    match messenger::send_friend_request(&state.pool, &user_id, &payload.receiver_messenger_id).await {
        Ok(request) => HttpResponse::Ok().json(serde_json::json!({
            "ok": true,
            "request": request
        })),
        Err(e) => HttpResponse::BadRequest().json(serde_json::json!({
            "ok": false,
            "error": e.to_string()
        })),
    }
}

async fn get_friend_requests_http(
    state: web::Data<AppState>,
    req: HttpRequest,
) -> impl Responder {
    let user_id = match user_id_from_request(&req, &state.jwt_secret) {
        Ok(id) => id,
        Err(_) => return HttpResponse::Unauthorized().json(serde_json::json!({
            "ok": false, "error": "Unauthorized"
        }))
    };
    
    match messenger::get_incoming_friend_requests(&state.pool, &user_id).await {
        Ok(requests) => HttpResponse::Ok().json(serde_json::json!({
            "ok": true,
            "requests": requests
        })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "ok": false,
            "error": e.to_string()
        })),
    }
}

async fn respond_to_friend_request_http(
    state: web::Data<AppState>,
    req: HttpRequest,
    path: web::Path<(String, bool)>,
) -> impl Responder {
    let (request_id, accept) = path.into_inner();
    let user_id = match user_id_from_request(&req, &state.jwt_secret) {
        Ok(id) => id,
        Err(_) => return HttpResponse::Unauthorized().json(serde_json::json!({
            "ok": false, "error": "Unauthorized"
        }))
    };

    // Парсим request_id из String в Uuid
    let req_uuid = match Uuid::parse_str(&request_id) {
        Ok(uuid) => uuid,
        Err(e) => return HttpResponse::BadRequest().json(serde_json::json!({
            "ok": false,
            "error": format!("Invalid request_id: {}", e)
        })),
    };

    match messenger::respond_to_friend_request(&state.pool, &user_id, &req_uuid, accept).await {
        Ok(()) => HttpResponse::Ok().json(serde_json::json!({
            "ok": true,
            "accepted": accept
        })),
        Err(e) => HttpResponse::BadRequest().json(serde_json::json!({
            "ok": false,
            "error": e.to_string()
        })),
    }
}

async fn get_contacts_http(
    state: web::Data<AppState>,
    req: HttpRequest,
) -> impl Responder {
    let user_id = match user_id_from_request(&req, &state.jwt_secret) {
        Ok(id) => id,
        Err(_) => return HttpResponse::Unauthorized().json(serde_json::json!({
            "ok": false, "error": "Unauthorized"
        }))
    };
    
    match messenger::get_contacts(&state.pool, &user_id).await {
        Ok(contacts) => HttpResponse::Ok().json(serde_json::json!({
            "ok": true,
            "contacts": contacts
        })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "ok": false,
            "error": e.to_string()
        })),
    }
}

async fn remove_contact_http(
    state: web::Data<AppState>,
    req: HttpRequest,
    contact_id: web::Path<String>,
) -> impl Responder {
    let user_id = match user_id_from_request(&req, &state.jwt_secret) {
        Ok(id) => id,
        Err(_) => return HttpResponse::Unauthorized().json(serde_json::json!({
            "ok": false, "error": "Unauthorized"
        }))
    };
    
    match messenger::remove_contact(&state.pool, &user_id, &contact_id).await {
        Ok(()) => HttpResponse::Ok().json(serde_json::json!({
            "ok": true
        })),
        Err(e) => HttpResponse::BadRequest().json(serde_json::json!({
            "ok": false,
            "error": e.to_string()
        })),
    }
}

async fn get_conversations_http(
    state: web::Data<AppState>,
    req: HttpRequest,
) -> impl Responder {
    let user_id = match user_id_from_request(&req, &state.jwt_secret) {
        Ok(id) => id,
        Err(_) => return HttpResponse::Unauthorized().json(serde_json::json!({
            "ok": false, "error": "Unauthorized"
        }))
    };
    
    match messenger::get_user_conversations(&state.pool, &user_id).await {
        Ok(conversations) => HttpResponse::Ok().json(serde_json::json!({
            "ok": true,
            "conversations": conversations
        })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "ok": false,
            "error": e.to_string()
        })),
    }
}

async fn create_conversation_http(
    state: web::Data<AppState>,
    req: HttpRequest,
    payload: web::Json<CreateConversationPayload>,
) -> impl Responder {
    let user_id = match user_id_from_request(&req, &state.jwt_secret) {
        Ok(id) => id,
        Err(_) => return HttpResponse::Unauthorized().json(serde_json::json!({
            "ok": false, "error": "Unauthorized"
        }))
    };

    let user = match messenger::get_messenger_profile(&state.pool, &user_id).await {
        Ok(Some(p)) => {
            AuthUser {
                id: user_id.clone(),
                username: p.display_name,
                email: String::new(),
                ip_address: String::new(),
                level: 1,
                xp: 0,
                reputation: 0,
                disk_capacity_mb: 512,
                role: "user".to_string(),
                created_at: None,
                last_login: None,
            }
        },
        _ => return HttpResponse::BadRequest().json(serde_json::json!({
            "ok": false,
            "error": "Messenger profile not found"
        }))
    };

    match messenger::create_conversation(
        &state.pool,
        &user.id,
        payload.user_ids.clone(),
        payload.name.clone(),
        payload.is_group,
    ).await {
        Ok(conversation) => HttpResponse::Ok().json(serde_json::json!({
            "ok": true,
            "conversation": conversation
        })),
        Err(e) => HttpResponse::BadRequest().json(serde_json::json!({
            "ok": false,
            "error": e.to_string()
        })),
    }
}

async fn get_messages_http(
    state: web::Data<AppState>,
    req: HttpRequest,
    path: web::Path<String>,
    query: web::Query<GetMessagesQuery>,
) -> impl Responder {
    let conversation_id = path.into_inner();
    let user_id = match user_id_from_request(&req, &state.jwt_secret) {
        Ok(id) => id,
        Err(_) => return HttpResponse::Unauthorized().json(serde_json::json!({
            "ok": false, "error": "Unauthorized"
        }))
    };
    
    let limit = query.limit.unwrap_or(50);
    let before = query.before.as_ref()
        .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
        .map(|dt| dt.with_timezone(&chrono::Utc));
    
    match messenger::get_conversation_messages(&state.pool, &conversation_id, &user_id, limit, before).await {
        Ok(messages) => HttpResponse::Ok().json(serde_json::json!({
            "ok": true,
            "messages": messages,
            "has_more": messages.len() as i32 >= limit
        })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "ok": false,
            "error": e.to_string()
        })),
    }
}

async fn send_message_http_api(
    state: web::Data<AppState>,
    req: HttpRequest,
    conversation_id: web::Path<String>,
    payload: web::Json<SendMessageApiPayload>,
) -> impl Responder {
    let user_id = match user_id_from_request(&req, &state.jwt_secret) {
        Ok(id) => id,
        Err(_) => return HttpResponse::Unauthorized().json(serde_json::json!({
            "ok": false, "error": "Unauthorized"
        }))
    };
    
    let user = match messenger::get_messenger_profile(&state.pool, &user_id).await {
        Ok(Some(p)) => {
            AuthUser {
                id: user_id.clone(),
                username: p.display_name,
                email: String::new(),
                ip_address: String::new(),
                level: 1,
                xp: 0,
                reputation: 0,
                disk_capacity_mb: 512,
                role: "user".to_string(),
                created_at: None,
                last_login: None,
            }
        },
        _ => return HttpResponse::BadRequest().json(serde_json::json!({
            "ok": false,
            "error": "Messenger profile not found"
        }))
    };

    match messenger::send_message(
        &state.pool,
        &user.id,
        &conversation_id,
        &payload.content.clone(),
        payload.message_type.clone(),
        payload.media_url.clone(),
        payload.reply_to_id.clone(),
    ).await {
        Ok(message) => HttpResponse::Ok().json(serde_json::json!({
            "ok": true,
            "message": message
        })),
        Err(e) => HttpResponse::BadRequest().json(serde_json::json!({
            "ok": false,
            "error": e.to_string()
        })),
    }
}

#[derive(Deserialize)]
struct SetupProfilePayload {
    messenger_id: String,
    display_name: String,
    about: Option<String>,
}

#[derive(Deserialize)]
struct UpdateProfilePayload {
    display_name: Option<String>,
    avatar_url: Option<String>,
    about: Option<String>,
}

#[derive(Deserialize)]
struct SearchUsersQuery {
    q: String,
}

#[derive(Deserialize)]
struct SendFriendRequestPayload {
    receiver_messenger_id: String,
}

#[derive(Deserialize)]
struct CreateConversationPayload {
    user_ids: Vec<String>,
    name: Option<String>,
    is_group: bool,
}

#[derive(Deserialize)]
struct GetMessagesQuery {
    limit: Option<i32>,
    before: Option<String>,
}

#[derive(Deserialize)]
struct SendMessageApiPayload {
    content: String,
    message_type: Option<String>,
    media_url: Option<String>,
    reply_to_id: Option<String>,
}

async fn send_message_http(
    state: web::Data<AppState>,
    req: HttpRequest,
    lot_id: web::Path<String>,
    payload: web::Json<SendMessagePayload>,
) -> impl Responder {
    let user_id = match user_id_from_request(&req, &state.jwt_secret) {
        Ok(id) => id,
        Err(_) => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "ok": false, "error": "Unauthorized"
            }))
        }
    };
    let lot_uuid = match Uuid::parse_str(&lot_id.into_inner()) {
        Ok(v) => v,
        Err(_) => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "ok": false, "error": "Invalid lot id"
            }))
        }
    };
    let user_uuid = match Uuid::parse_str(&user_id) {
        Ok(v) => v,
        Err(_) => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "ok": false, "error": "Invalid user id"
            }))
        }
    };
    let text = payload.text.trim();
    if text.is_empty() {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "ok": false, "error": "Message cannot be empty"
        }));
    }

    let thread = sqlx::query_as::<_, MarketplaceThreadRow>(
        r#"
        SELECT id, lot_id, buyer_user_id, seller_user_id, status
        FROM marketplace_threads
        WHERE lot_id = $1 AND (buyer_user_id = $2 OR seller_user_id = $2)
        LIMIT 1
        "#,
    )
    .bind(lot_uuid)
    .bind(user_uuid)
    .fetch_optional(&state.pool)
    .await;

    let thread = match thread {
        Ok(Some(t)) => t,
        Ok(None) => {
            return HttpResponse::NotFound().json(serde_json::json!({
                "ok": false, "error": "Thread not found"
            }))
        }
        Err(e) => {
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "ok": false, "error": format!("Failed to load thread: {e}")
            }))
        }
    };

    let _ = sqlx::query(
        r#"
        INSERT INTO marketplace_messages (thread_id, from_user_id, message_text)
        VALUES ($1, $2, $3)
        "#,
    )
    .bind(thread.id)
    .bind(user_uuid)
    .bind(text)
    .execute(&state.pool)
    .await;

    let _ = sqlx::query(
        r#"
        UPDATE marketplace_threads
        SET status = CASE
            WHEN seller_user_id = $2 THEN 'in_progress'
            ELSE status
        END
        WHERE id = $1
        "#,
    )
    .bind(thread.id)
    .bind(user_uuid)
    .execute(&state.pool)
    .await;

    HttpResponse::Ok().json(serde_json::json!({ "ok": true }))
}

#[actix_web::main]
async fn main() -> anyhow::Result<()> {
    // Load `backend/.env` even when CWD is repo root (e.g. `cargo run --manifest-path ...`).
    let env_path = Path::new(env!("CARGO_MANIFEST_DIR")).join(".env");
    let _ = dotenvy::from_path(&env_path).ok();
    dotenv().ok();
    env_logger::init();

    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL is required");
    let jwt_secret = env::var("JWT_SECRET").expect("JWT_SECRET is required");
    let ws_host = env::var("WS_HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let ws_port: u16 = env::var("WS_PORT")
        .unwrap_or_else(|_| "8080".to_string())
        .parse()
        .expect("WS_PORT must be a number");

    let http_host = env::var("HTTP_HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let http_port: u16 = env::var("HTTP_PORT")
        .unwrap_or_else(|_| "8000".to_string())
        .parse()
        .expect("HTTP_PORT must be a number");
    let web_origin = env::var("WEB_ORIGIN").unwrap_or_else(|_| "http://localhost:3000".to_string());

    let pool = db::create_pool(&database_url).await?;
    // Отдельно от `AppState`: обработчики с `web::Data<PgPool>` (fs_online, /debug/db, каталог браузера).
    let pool_data = web::Data::new(pool.clone());

    info!("DB connected");

    // Создаем глобальное хранилище активных WebSocket подключений
    let connections: websocket::SharedConnections = Arc::new(RwLock::new(std::collections::HashMap::new()));

    let ws_task = {
        let ws_host = ws_host.clone();
        let ws_pool = pool.clone();
        let ws_secret = jwt_secret.clone();
        let connections = Arc::clone(&connections);
        tokio::spawn(async move { websocket::run_ws_server(&ws_host, ws_port, ws_pool, ws_secret, connections).await })
    };

    let rate_limiter = RateLimiter::for_auth();
    
    let state = web::Data::new(AppState {
        pool,
        jwt_secret: jwt_secret.clone(),
        rate_limiter,
    });

    // Разрешаем все origins для разработки или указываем конкретные
    let _cors_origin = web_origin.clone();

    info!("HTTP server listening on http://{http_host}:{http_port}");

    let server = HttpServer::new(move || {
        let cors = Cors::default()
            .allow_any_origin()
            .allowed_methods(vec!["GET", "POST", "PUT", "DELETE", "OPTIONS"])
            .allowed_headers(vec![
                actix_web::http::header::AUTHORIZATION,
                actix_web::http::header::CONTENT_TYPE,
                actix_web::http::header::ACCEPT,
                actix_web::http::header::ORIGIN,
            ])
            .supports_credentials()
            .max_age(3600);
        App::new()
            .app_data(state.clone())
            .app_data(pool_data.clone())
            .wrap(cors)
            .wrap(Logger::default())
            .route("/health", web::get().to(health))
            .route("/debug/db", web::get().to(debug_db))
            .route("/auth/register", web::post().to(register_http))
            .route("/auth/login", web::post().to(login_http))
            .route("/beta-apply", web::post().to(beta_apply_http))
            .route("/auth/me", web::get().to(me_http))
            .route("/auth/change-password", web::post().to(change_password_http))
            .route("/auth/refresh", web::post().to(admin_http::refresh_token_http))
            .route("/auth/logout", web::post().to(admin_http::logout_http))
            // Admin API
            .route("/admin/stats", web::get().to(admin_http::get_stats_http))
            .route("/admin/users", web::get().to(admin_http::get_users_http))
            .route("/admin/users/{user_id}", web::patch().to(admin_http::update_user_http))
            .route("/admin/users/{user_id}/ban", web::post().to(admin_http::ban_user_http))
            .route("/admin/grant-me", web::post().to(admin_http::grant_admin_to_me))
            .route("/admin/users/{user_id}/role", web::post().to(admin_http::change_role_http))
            .route("/admin/logs", web::get().to(admin_http::get_logs_http))
            .route("/admin/beta-applications", web::get().to(admin_http::get_beta_applications_http))
            .route("/admin/beta-applications/{id}", web::patch().to(admin_http::update_beta_application_http))
            // Subscription API
            .route("/subscription/modules", web::get().to(subscription_http::get_modules_http))
            .route("/subscription/my", web::get().to(subscription_http::get_my_subscription_http))
            .route("/subscription", web::post().to(subscription_http::create_subscription_http))
            .route("/subscription/module", web::post().to(subscription_http::add_module_http))
            .route("/subscription/module", web::delete().to(subscription_http::remove_module_http))
            .route("/subscription/cancel", web::post().to(subscription_http::cancel_subscription_http))
            .route("/subscription/renew", web::post().to(subscription_http::renew_subscription_http))
            .route("/marketplace/lots", web::get().to(list_lots_http))
            .route("/marketplace/lots", web::post().to(create_lot_http))
            .route("/marketplace/my/lots", web::get().to(my_lots_http))
            .route("/marketplace/my/deals", web::get().to(my_deals_http))
            .route("/marketplace/lots/{lot_id}/request", web::post().to(request_deal_http))
            .route("/marketplace/lots/{lot_id}/thread", web::get().to(get_thread_http))
            .route("/marketplace/lots/{lot_id}/messages", web::post().to(send_message_http))
            // Browser API
            .route("/api/browser/sites", web::get().to(browser_catalog_sites))
            .route("/api/browser/search", web::get().to(browser_catalog_search))
            .route("/api/browser/bookmarks", web::get().to(get_bookmarks))
            .route("/api/browser/bookmarks", web::post().to(create_bookmark))
            .route("/api/browser/bookmarks/{bookmark_id}", web::delete().to(delete_bookmark))
            .route("/api/browser/bookmarks/{bookmark_id}", web::put().to(update_bookmark_http))
            .route("/api/browser/settings", web::get().to(get_settings))
            .route("/api/browser/settings", web::put().to(update_settings))
            .route("/api/browser/history/{entry_id}", web::delete().to(delete_history_entry_http))
            .route("/api/browser/history", web::delete().to(clear_history_http))
            .route("/api/browser/history", web::get().to(list_history_http))
            .route("/api/browser/history", web::post().to(append_history_http))
            // Sites - прямая раздача статических файлов (для iframe в браузере)
            .route("/sites/{site_name}/{file_path:.*}", web::get().to(get_site_file_http))
            .route("/sites/{site_name}", web::get().to(|site_name: web::Path<String>| async move {
                let path = web::Path::from((site_name.into_inner(), "index.html".to_string()));
                get_site_file_http(path).await
            }))
            // Sites API (статические файлы сайтов)
            .route("/api/sites", web::get().to(get_sites_list))
            .route("/api/sites", web::post().to(create_site_http))
            .route("/api/sites/{site_name}", web::delete().to(delete_site_http))
            .route("/api/sites/{site_name}/files", web::get().to(list_site_files_http))
            .route("/api/sites/{site_name}/files/{file_path:.*}", web::get().to(get_site_file_http))
            .route("/api/sites/{site_name}/files", web::post().to(upload_site_file_http))
            .route("/api/sites/{site_name}/files/{file_path:.*}", web::delete().to(delete_site_file_http))
            // Messenger API (HTTP альтернатива WebSocket)
            .route("/api/messenger/profile", web::get().to(get_messenger_profile_http))
            .route("/api/messenger/profile", web::post().to(setup_messenger_profile_http))
            .route("/api/messenger/profile", web::put().to(update_messenger_profile_http))
            .route("/api/messenger/search", web::get().to(search_users_http))
            .route("/api/messenger/friends/requests", web::get().to(get_friend_requests_http))
            .route("/api/messenger/friends/requests", web::post().to(send_friend_request_http))
            .route("/api/messenger/friends/requests/{request_id}", web::post().to(respond_to_friend_request_http))
            .route("/api/messenger/contacts", web::get().to(get_contacts_http))
            .route("/api/messenger/contacts/{contact_id}", web::delete().to(remove_contact_http))
            .route("/api/messenger/conversations", web::get().to(get_conversations_http))
            .route("/api/messenger/conversations", web::post().to(create_conversation_http))
            .route("/api/messenger/conversations/{conversation_id}/messages", web::get().to(get_messages_http))
            .route("/api/messenger/conversations/{conversation_id}/messages", web::post().to(send_message_http_api))
            // Online File System API (с JWT аутентификацией)
            .route("/api/fs/list", web::get().to(fs_list_http))
            .route("/api/fs/create", web::post().to(fs_create_http))
            .route("/api/fs/delete", web::post().to(fs_delete_http))
            .route("/api/fs/move", web::post().to(fs_move_http))
            .route("/api/fs/read/{path:.*}", web::get().to(fs_read_http))
            .route("/api/fs/write", web::post().to(fs_write_http))
    })
    .bind((http_host.as_str(), http_port))?
    .run();

    tokio::select! {
        res = server => {
            res?;
        }
        res = ws_task => {
            match res {
                Ok(Ok(())) => {}
                Ok(Err(e)) => return Err(e),
                Err(e) => return Err(anyhow::anyhow!(e)),
            }
        }
        _ = tokio::signal::ctrl_c() => {
            info!("shutdown signal received");
        }
    }

    Ok(())
}

