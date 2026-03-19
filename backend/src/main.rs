use actix_cors::Cors;
use actix_web::{middleware::Logger, web, App, HttpRequest, HttpResponse, HttpServer, Responder};
use dotenvy::dotenv;
use log::info;
use sqlx::migrate::Migrator;
use sqlx::PgPool;
use std::env;
use std::path::Path;
use uuid::Uuid;
use zeroday_backend::{auth, db, websocket};

#[derive(Clone)]
struct AppState {
    pool: PgPool,
    jwt_secret: String,
}

async fn health() -> impl Responder {
    HttpResponse::Ok().json(serde_json::json!({ "ok": true }))
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

fn user_id_from_request(req: &HttpRequest, jwt_secret: &str) -> anyhow::Result<String> {
    let token = bearer_token(req).ok_or_else(|| anyhow::anyhow!("Unauthorized"))?;
    auth::decode_user_id_from_jwt(token, jwt_secret)
}

async fn register_http(state: web::Data<AppState>, payload: web::Json<RegisterPayload>) -> impl Responder {
    match auth::register_user(
        &state.pool,
        &state.jwt_secret,
        &payload.username,
        &payload.email,
        &payload.password,
    )
    .await
    {
        Ok((token, user)) => HttpResponse::Ok().json(serde_json::json!({
            "ok": true,
            "token": token,
            "user": user
        })),
        Err(e) => HttpResponse::BadRequest().json(serde_json::json!({
            "ok": false,
            "error": e.to_string()
        })),
    }
}

async fn login_http(state: web::Data<AppState>, payload: web::Json<LoginPayload>) -> impl Responder {
    match auth::login_user(&state.pool, &state.jwt_secret, &payload.login, &payload.password).await {
        Ok((token, user)) => HttpResponse::Ok().json(serde_json::json!({
            "ok": true,
            "token": token,
            "user": user
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

    let mut sql = QueryBuilder::new(
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

    let mut count_sql = QueryBuilder::new(
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

    let mut sql = QueryBuilder::new(
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

    let mut count_sql = QueryBuilder::new("SELECT COUNT(*) FROM marketplace_lots l WHERE l.seller_user_id = ");
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

    let mut sql = QueryBuilder::new(
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

    let mut count_sql = QueryBuilder::new(
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
    let migrations_dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("migrations");
    let migrator = Migrator::new(migrations_dir).await?;
    migrator.run(&pool).await?;

    info!("DB connected and migrations applied");

    let ws_task = {
        let ws_host = ws_host.clone();
        let ws_pool = pool.clone();
        let ws_secret = jwt_secret.clone();
        tokio::spawn(async move { websocket::run_ws_server(&ws_host, ws_port, ws_pool, ws_secret).await })
    };

    let state = web::Data::new(AppState {
        pool,
        jwt_secret: jwt_secret.clone(),
    });
    let cors_origin = web_origin.clone();

    info!("HTTP server listening on http://{http_host}:{http_port}");

    let server = HttpServer::new(move || {
        let cors = Cors::default()
            .allowed_origin(&cors_origin)
            .allowed_methods(vec!["GET", "POST", "OPTIONS"])
            .allowed_headers(vec![
                actix_web::http::header::AUTHORIZATION,
                actix_web::http::header::CONTENT_TYPE,
                actix_web::http::header::ACCEPT,
            ])
            .supports_credentials()
            .max_age(3600);
        App::new()
            .app_data(state.clone())
            .wrap(cors)
            .wrap(Logger::default())
            .route("/health", web::get().to(health))
            .route("/auth/register", web::post().to(register_http))
            .route("/auth/login", web::post().to(login_http))
            .route("/auth/me", web::get().to(me_http))
            .route("/auth/change-password", web::post().to(change_password_http))
            .route("/marketplace/lots", web::get().to(list_lots_http))
            .route("/marketplace/lots", web::post().to(create_lot_http))
            .route("/marketplace/my/lots", web::get().to(my_lots_http))
            .route("/marketplace/my/deals", web::get().to(my_deals_http))
            .route("/marketplace/lots/{lot_id}/request", web::post().to(request_deal_http))
            .route("/marketplace/lots/{lot_id}/thread", web::get().to(get_thread_http))
            .route("/marketplace/lots/{lot_id}/messages", web::post().to(send_message_http))
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

