//! HTTP обработчики для админ-панели

use actix_web::{web, HttpRequest, HttpResponse, Responder};
use serde::{Deserialize};
use uuid::Uuid;

use crate::admin;
use crate::auth;

fn bearer_token(req: &HttpRequest) -> Option<&str> {
    let header = req.headers().get("Authorization")?.to_str().ok()?;
    header.strip_prefix("Bearer ")
}

fn user_id_from_request(req: &HttpRequest, jwt_secret: &str) -> Result<String, actix_web::Error> {
    use actix_web::error::ErrorUnauthorized;
    let token = bearer_token(req)
        .ok_or_else(|| ErrorUnauthorized("Missing Authorization header"))?;
    auth::decode_user_id_from_jwt(token, jwt_secret)
        .map_err(|_| ErrorUnauthorized("Invalid JWT token"))
}

fn admin_user_id_from_request(req: &HttpRequest, jwt_secret: &str) -> Result<Uuid, actix_web::Error> {
    use actix_web::error::ErrorForbidden;
    let user_id_str = user_id_from_request(req, jwt_secret)?;
    let user_id = Uuid::parse_str(&user_id_str)
        .map_err(|_| ErrorForbidden("Invalid user ID"))?;
    Ok(user_id)
}

// ==================== СТАТИСТИКА ====================

#[derive(Deserialize)]
pub struct PaginationQuery {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
}

pub async fn get_stats_http(state: web::Data<crate::AppState>, req: HttpRequest) -> impl Responder {
    let jwt_secret = &state.jwt_secret;
    
    // Проверяем, что пользователь авторизован
    match user_id_from_request(&req, jwt_secret) {
        Ok(_) => {}
        Err(_) => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "ok": false,
                "error": "Unauthorized"
            }));
        }
    };

    match admin::get_admin_stats(&state.pool).await {
        Ok(stats) => HttpResponse::Ok().json(serde_json::json!({
            "ok": true,
            "stats": stats
        })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "ok": false,
            "error": e.to_string()
        })),
    }
}

// ==================== ПОЛЬЗОВАТЕЛИ ====================

#[derive(Deserialize)]
pub struct UsersQuery {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
    pub search: Option<String>,
    pub sort: Option<String>,
}

pub async fn get_users_http(
    state: web::Data<crate::AppState>,
    req: HttpRequest,
    query: web::Query<UsersQuery>,
) -> impl Responder {
    let jwt_secret = &state.jwt_secret;
    
    // Проверяем права админа
    let user_id = match admin_user_id_from_request(&req, jwt_secret) {
        Ok(id) => id,
        Err(_) => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "ok": false,
                "error": "Unauthorized"
            }));
        }
    };

    if let Err(e) = admin::require_admin(&state.pool, &user_id).await {
        return HttpResponse::Forbidden().json(serde_json::json!({
            "ok": false,
            "error": e.to_string()
        }));
    }

    let page = query.page.unwrap_or(1).max(1);
    let per_page = query.per_page.unwrap_or(20).clamp(1, 100);

    match admin::get_users(&state.pool, page, per_page, query.search.as_deref(), query.sort.as_deref()).await {
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

#[derive(Deserialize)]
pub struct UserUpdatePayload {
    pub level: Option<i32>,
    pub xp: Option<i32>,
    pub reputation: Option<i32>,
    pub disk_capacity_mb: Option<i32>,
}

pub async fn update_user_http(
    state: web::Data<crate::AppState>,
    req: HttpRequest,
    path: web::Path<String>,
    payload: web::Json<UserUpdatePayload>,
) -> impl Responder {
    let jwt_secret = &state.jwt_secret;
    
    let admin_id = match admin_user_id_from_request(&req, jwt_secret) {
        Ok(id) => id,
        Err(_) => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "ok": false,
                "error": "Unauthorized"
            }));
        }
    };

    if let Err(e) = admin::require_admin(&state.pool, &admin_id).await {
        return HttpResponse::Forbidden().json(serde_json::json!({
            "ok": false,
            "error": e.to_string()
        }));
    }

    let user_id = match Uuid::parse_str(&path.into_inner()) {
        Ok(id) => id,
        Err(_) => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "ok": false,
                "error": "Invalid user ID"
            }));
        }
    };

    let updates = serde_json::json!({
        "level": payload.level,
        "xp": payload.xp,
        "reputation": payload.reputation,
        "disk_capacity_mb": payload.disk_capacity_mb
    });

    match admin::update_user(&state.pool, &admin_id, &user_id, updates).await {
        Ok(user) => HttpResponse::Ok().json(serde_json::json!({
            "ok": true,
            "user": user
        })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "ok": false,
            "error": e.to_string()
        })),
    }
}

#[derive(Deserialize)]
pub struct BanPayload {
    pub banned: bool,
}

pub async fn ban_user_http(
    state: web::Data<crate::AppState>,
    req: HttpRequest,
    path: web::Path<String>,
    payload: web::Json<BanPayload>,
) -> impl Responder {
    let jwt_secret = &state.jwt_secret;
    
    let admin_id = match admin_user_id_from_request(&req, jwt_secret) {
        Ok(id) => id,
        Err(_) => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "ok": false,
                "error": "Unauthorized"
            }));
        }
    };

    if let Err(e) = admin::require_admin(&state.pool, &admin_id).await {
        return HttpResponse::Forbidden().json(serde_json::json!({
            "ok": false,
            "error": e.to_string()
        }));
    }

    let user_id = match Uuid::parse_str(&path.into_inner()) {
        Ok(id) => id,
        Err(_) => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "ok": false,
                "error": "Invalid user ID"
            }));
        }
    };

    match admin::ban_user(&state.pool, &admin_id, &user_id, payload.banned).await {
        Ok(()) => HttpResponse::Ok().json(serde_json::json!({
            "ok": true
        })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "ok": false,
            "error": e.to_string()
        })),
    }
}

#[derive(Deserialize)]
pub struct RolePayload {
    pub role: String,
}

pub async fn change_role_http(
    state: web::Data<crate::AppState>,
    req: HttpRequest,
    path: web::Path<String>,
    payload: web::Json<RolePayload>,
) -> impl Responder {
    let jwt_secret = &state.jwt_secret;
    
    let admin_id = match admin_user_id_from_request(&req, jwt_secret) {
        Ok(id) => id,
        Err(_) => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "ok": false,
                "error": "Unauthorized"
            }));
        }
    };

    if let Err(e) = admin::require_admin(&state.pool, &admin_id).await {
        return HttpResponse::Forbidden().json(serde_json::json!({
            "ok": false,
            "error": e.to_string()
        }));
    }

    let user_id = match Uuid::parse_str(&path.into_inner()) {
        Ok(id) => id,
        Err(_) => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "ok": false,
                "error": "Invalid user ID"
            }));
        }
    };

    match admin::change_user_role(&state.pool, &admin_id, &user_id, &payload.role).await {
        Ok(()) => HttpResponse::Ok().json(serde_json::json!({
            "ok": true
        })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "ok": false,
            "error": e.to_string()
        })),
    }
}

// ==================== ЛОГИ ====================

pub async fn get_logs_http(
    state: web::Data<crate::AppState>,
    req: HttpRequest,
    query: web::Query<PaginationQuery>,
) -> impl Responder {
    let jwt_secret = &state.jwt_secret;
    
    let user_id = match admin_user_id_from_request(&req, jwt_secret) {
        Ok(id) => id,
        Err(_) => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "ok": false,
                "error": "Unauthorized"
            }));
        }
    };

    if let Err(e) = admin::require_admin(&state.pool, &user_id).await {
        return HttpResponse::Forbidden().json(serde_json::json!({
            "ok": false,
            "error": e.to_string()
        }));
    }

    let page = query.page.unwrap_or(1).max(1);
    let per_page = query.per_page.unwrap_or(50).clamp(1, 100);

    match admin::get_admin_logs(&state.pool, page, per_page).await {
        Ok(logs) => HttpResponse::Ok().json(serde_json::json!({
            "ok": true,
            "logs": logs
        })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "ok": false,
            "error": e.to_string()
        })),
    }
}

// ==================== БЕТА-ЗАЯВКИ ====================

#[derive(Deserialize)]
pub struct BetaApplicationsQuery {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
    pub status: Option<String>,
}

pub async fn get_beta_applications_http(
    state: web::Data<crate::AppState>,
    req: HttpRequest,
    query: web::Query<BetaApplicationsQuery>,
) -> impl Responder {
    let jwt_secret = &state.jwt_secret;
    
    let user_id = match admin_user_id_from_request(&req, jwt_secret) {
        Ok(id) => id,
        Err(_) => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "ok": false,
                "error": "Unauthorized"
            }));
        }
    };

    if let Err(e) = admin::require_admin(&state.pool, &user_id).await {
        return HttpResponse::Forbidden().json(serde_json::json!({
            "ok": false,
            "error": e.to_string()
        }));
    }

    let page = query.page.unwrap_or(1).max(1);
    let per_page = query.per_page.unwrap_or(20).clamp(1, 100);

    match admin::get_beta_applications(&state.pool, page, per_page, query.status.as_deref()).await {
        Ok(applications) => HttpResponse::Ok().json(serde_json::json!({
            "ok": true,
            "applications": applications
        })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "ok": false,
            "error": e.to_string()
        })),
    }
}

#[derive(Deserialize)]
pub struct BetaApplicationStatusPayload {
    pub status: String,
}

pub async fn update_beta_application_http(
    state: web::Data<crate::AppState>,
    req: HttpRequest,
    path: web::Path<String>,
    payload: web::Json<BetaApplicationStatusPayload>,
) -> impl Responder {
    let jwt_secret = &state.jwt_secret;
    
    let admin_id = match admin_user_id_from_request(&req, jwt_secret) {
        Ok(id) => id,
        Err(_) => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "ok": false,
                "error": "Unauthorized"
            }));
        }
    };

    if let Err(e) = admin::require_admin(&state.pool, &admin_id).await {
        return HttpResponse::Forbidden().json(serde_json::json!({
            "ok": false,
            "error": e.to_string()
        }));
    }

    let application_id = match Uuid::parse_str(&path.into_inner()) {
        Ok(id) => id,
        Err(_) => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "ok": false,
                "error": "Invalid application ID"
            }));
        }
    };

    match admin::update_beta_application(&state.pool, &admin_id, &application_id, &payload.status).await {
        Ok(()) => HttpResponse::Ok().json(serde_json::json!({
            "ok": true
        })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "ok": false,
            "error": e.to_string()
        })),
    }
}

// ==================== TOKEN REFRESH ====================

#[derive(Deserialize)]
pub struct RefreshPayload {
    pub refresh_token: String,
}

pub async fn refresh_token_http(state: web::Data<crate::AppState>, payload: web::Json<RefreshPayload>) -> impl Responder {
    use jsonwebtoken::{Algorithm, Validation};
    use crate::auth::RefreshClaims;
    
    let token = payload.refresh_token.trim();
    if token.is_empty() {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "ok": false,
            "error": "Refresh token required"
        }));
    }

    // Декодируем refresh токен
    let validation = Validation::new(Algorithm::HS256);
    let token_data = match jsonwebtoken::decode::<RefreshClaims>(
        token,
        &crate::jwt_decoding_key(&state.jwt_secret),
        &validation,
    ) {
        Ok(data) => data,
        Err(e) => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "ok": false,
                "error": format!("Invalid refresh token: {}", e)
            }));
        }
    };

    let user_id = match Uuid::parse_str(&token_data.claims.sub) {
        Ok(id) => id,
        Err(_) => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "ok": false,
                "error": "Invalid token subject"
            }));
        }
    };

    // Проверяем refresh токен в БД
    match auth::verify_refresh_token(&state.pool, &user_id, token).await {
        Ok(Some(_)) => {}
        Ok(None) => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "ok": false,
                "error": "Refresh token not found or revoked"
            }));
        }
        Err(e) => {
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "ok": false,
                "error": format!("Database error: {}", e)
            }));
        }
    }

    // Обновляем токены
    match auth::refresh_tokens(&state.pool, &state.jwt_secret, &user_id, token).await {
        Ok(tokens) => HttpResponse::Ok().json(serde_json::json!({
            "ok": true,
            "token": tokens.token,
            "refresh_token": tokens.refresh_token,
            "expires_in": tokens.expires_in
        })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "ok": false,
            "error": e.to_string()
        })),
    }
}

// ==================== LOGOUT ====================

pub async fn logout_http(state: web::Data<crate::AppState>, req: HttpRequest) -> impl Responder {
    let jwt_secret = &state.jwt_secret;
    
    let user_id = match user_id_from_request(&req, jwt_secret) {
        Ok(id_str) => match Uuid::parse_str(&id_str) {
            Ok(id) => id,
            Err(_) => {
                return HttpResponse::BadRequest().json(serde_json::json!({
                    "ok": false,
                    "error": "Invalid user ID"
                }));
            }
        },
        Err(_) => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "ok": false,
                "error": "Unauthorized"
            }));
        }
    };

    // Получаем refresh токен из заголовка если есть
    let refresh_token = bearer_token(&req);

    match auth::logout_user(&state.pool, &user_id, refresh_token).await {
        Ok(()) => HttpResponse::Ok().json(serde_json::json!({
            "ok": true
        })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "ok": false,
            "error": e.to_string()
        })),
    }
}
