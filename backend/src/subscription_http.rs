//! HTTP обработчики для модульной системы подписок

use actix_web::{web, HttpRequest, HttpResponse, Responder};
use serde::Deserialize;
use uuid::Uuid;

use crate::subscription;
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

// ==================== ЗАПРОСЫ ====================

#[derive(Deserialize)]
pub struct ModuleCategoryQuery {
    category: Option<String>,
}

// ==================== ОБРАБОТЧИКИ ====================

/// Получить все доступные модули подписки
pub async fn get_modules_http(
    state: web::Data<crate::AppState>,
    query: web::Query<ModuleCategoryQuery>,
) -> impl Responder {
    match subscription::get_available_modules(&state.pool).await {
        Ok(modules) => {
            // Фильтруем по категории если указано
            let filtered: Vec<_> = if let Some(ref category) = query.category {
                modules.into_iter()
                    .filter(|m| &m.category == category)
                    .collect()
            } else {
                modules
            };

            HttpResponse::Ok().json(serde_json::json!({
                "ok": true,
                "modules": filtered
            }))
        }
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "ok": false,
            "error": e.to_string()
        })),
    }
}

/// Получить активную подписку пользователя с модулями
pub async fn get_my_subscription_http(
    state: web::Data<crate::AppState>,
    req: HttpRequest,
) -> impl Responder {
    let jwt_secret = &state.jwt_secret;

    let user_id_str = match user_id_from_request(&req, jwt_secret) {
        Ok(id) => id,
        Err(_) => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "ok": false,
                "error": "Unauthorized"
            }));
        }
    };

    let user_id = match Uuid::parse_str(&user_id_str) {
        Ok(id) => id,
        Err(_) => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "ok": false,
                "error": "Invalid user ID"
            }));
        }
    };

    // Получаем активную подписку
    match subscription::get_user_active_subscription(&state.pool, &user_id).await {
        Ok(Some(subscription)) => {
            // Получаем модули подписки
            let user_modules = match subscription::get_user_subscription_modules(&state.pool, &subscription.id).await {
                Ok(modules) => modules,
                Err(e) => {
                    log::error!("Failed to get subscription modules: {}", e);
                    vec![]
                }
            };

            // Получаем каталог модулей для информации
            let catalog = match subscription::get_available_modules(&state.pool).await {
                Ok(modules) => modules,
                Err(_) => vec![],
            };

            // Формируем информацию о модулях
            let modules_info: Vec<subscription::SubscriptionModuleInfo> = user_modules.iter().map(|um| {
                let catalog_module = catalog.iter().find(|m| m.id == um.module_id);
                subscription::SubscriptionModuleInfo {
                    id: um.module_id.clone(),
                    name: catalog_module.map(|m| m.name.clone()).unwrap_or_default(),
                    description: catalog_module.and_then(|m| m.description.clone()),
                    icon: catalog_module.and_then(|m| m.icon.clone()),
                    category: catalog_module.map(|m| m.category.clone()).unwrap_or_default(),
                    price_monthly: um.monthly_price,
                    price_yearly: um.yearly_price,
                    discount_percent: catalog_module.map(|m| m.discount_percent).unwrap_or(0),
                    available: catalog_module.map(|m| m.available).unwrap_or(false),
                    selected: true,
                }
            }).collect();

            HttpResponse::Ok().json(serde_json::json!({
                "ok": true,
                "subscription": {
                    "id": subscription.id,
                    "status": subscription.status,
                    "total_monthly_price": subscription.total_monthly_price,
                    "total_yearly_price": subscription.total_yearly_price,
                    "billing_period": subscription.billing_period,
                    "auto_renew": subscription.auto_renew,
                    "started_at": subscription.started_at,
                    "expires_at": subscription.expires_at,
                    "modules": modules_info
                }
            }))
        }
        Ok(None) => {
            HttpResponse::Ok().json(serde_json::json!({
                "ok": true,
                "subscription": null
            }))
        }
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "ok": false,
            "error": e.to_string()
        })),
    }
}

/// Создать новую подписку
#[derive(Deserialize)]
pub struct CreateSubscriptionPayload {
    billing_period: String,
    auto_renew: Option<bool>,
    module_ids: Vec<String>,
}

pub async fn create_subscription_http(
    state: web::Data<crate::AppState>,
    req: HttpRequest,
    payload: web::Json<CreateSubscriptionPayload>,
) -> impl Responder {
    let jwt_secret = &state.jwt_secret;

    let user_id_str = match user_id_from_request(&req, jwt_secret) {
        Ok(id) => id,
        Err(_) => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "ok": false,
                "error": "Unauthorized"
            }));
        }
    };

    let user_id = match Uuid::parse_str(&user_id_str) {
        Ok(id) => id,
        Err(_) => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "ok": false,
                "error": "Invalid user ID"
            }));
        }
    };

    // Проверяем, есть ли уже активная подписка
    if let Ok(Some(_)) = subscription::get_user_active_subscription(&state.pool, &user_id).await {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "ok": false,
            "error": "У вас уже есть активная подписка"
        }));
    }

    // Создаем подписку
    let auto_renew = payload.auto_renew.unwrap_or(true);
    match subscription::create_user_subscription(&state.pool, &user_id, &payload.billing_period, auto_renew).await {
        Ok(subscription) => {
            // Добавляем выбранные модули
            for module_id in &payload.module_ids {
                if let Err(e) = subscription::add_module_to_subscription(&state.pool, &subscription.id, module_id).await {
                    log::warn!("Failed to add module {}: {}", module_id, e);
                }
            }

            // Создаем транзакцию
            let charge_amount = if payload.billing_period == "yearly" {
                subscription.total_yearly_price
            } else {
                subscription.total_monthly_price
            };

            if charge_amount > 0 {
                let _ = subscription::create_subscription_transaction(
                    &state.pool,
                    &user_id,
                    Some(&subscription.id),
                    charge_amount,
                    "charge",
                    &format!("Оплата подписки ({})", payload.billing_period),
                ).await;
            }

            HttpResponse::Created().json(serde_json::json!({
                "ok": true,
                "subscription": subscription
            }))
        }
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "ok": false,
            "error": e.to_string()
        })),
    }
}

/// Добавить модуль к подписке
#[derive(Deserialize)]
pub struct AddModulePayload {
    module_id: String,
}

pub async fn add_module_http(
    state: web::Data<crate::AppState>,
    req: HttpRequest,
    payload: web::Json<AddModulePayload>,
) -> impl Responder {
    let jwt_secret = &state.jwt_secret;

    let user_id_str = match user_id_from_request(&req, jwt_secret) {
        Ok(id) => id,
        Err(_) => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "ok": false,
                "error": "Unauthorized"
            }));
        }
    };

    let user_id = match Uuid::parse_str(&user_id_str) {
        Ok(id) => id,
        Err(_) => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "ok": false,
                "error": "Invalid user ID"
            }));
        }
    };

    // Получаем активную подписку
    let subscription = match subscription::get_user_active_subscription(&state.pool, &user_id).await {
        Ok(Some(s)) => s,
        Ok(None) => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "ok": false,
                "error": "У вас нет активной подписки"
            }));
        }
        Err(e) => {
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "ok": false,
                "error": e.to_string()
            }));
        }
    };

    // Добавляем модуль
    match subscription::add_module_to_subscription(&state.pool, &subscription.id, &payload.module_id).await {
        Ok(price_change) => {
            // Создаем транзакцию для прорации (если нужно)
            if price_change > 0 {
                let _ = subscription::create_subscription_transaction(
                    &state.pool,
                    &user_id,
                    Some(&subscription.id),
                    price_change,
                    "proration",
                    &format!("Добавление модуля {}", payload.module_id),
                ).await;
            }

            HttpResponse::Ok().json(serde_json::json!({
                "ok": true,
                "message": "Модуль добавлен",
                "price_change": price_change
            }))
        }
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "ok": false,
            "error": e.to_string()
        })),
    }
}

/// Удалить модуль из подписки
#[derive(Deserialize)]
pub struct RemoveModulePayload {
    module_id: String,
}

pub async fn remove_module_http(
    state: web::Data<crate::AppState>,
    req: HttpRequest,
    payload: web::Json<RemoveModulePayload>,
) -> impl Responder {
    let jwt_secret = &state.jwt_secret;

    let user_id_str = match user_id_from_request(&req, jwt_secret) {
        Ok(id) => id,
        Err(_) => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "ok": false,
                "error": "Unauthorized"
            }));
        }
    };

    let user_id = match Uuid::parse_str(&user_id_str) {
        Ok(id) => id,
        Err(_) => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "ok": false,
                "error": "Invalid user ID"
            }));
        }
    };

    // Получаем активную подписку
    let subscription = match subscription::get_user_active_subscription(&state.pool, &user_id).await {
        Ok(Some(s)) => s,
        Ok(None) => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "ok": false,
                "error": "У вас нет активной подписки"
            }));
        }
        Err(e) => {
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "ok": false,
                "error": e.to_string()
            }));
        }
    };

    // Удаляем модуль
    match subscription::remove_module_from_subscription(&state.pool, &subscription.id, &payload.module_id).await {
        Ok(price_change) => {
            HttpResponse::Ok().json(serde_json::json!({
                "ok": true,
                "message": "Модуль удален",
                "price_change": price_change
            }))
        }
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "ok": false,
            "error": e.to_string()
        })),
    }
}

/// Отменить подписку
pub async fn cancel_subscription_http(
    state: web::Data<crate::AppState>,
    req: HttpRequest,
) -> impl Responder {
    let jwt_secret = &state.jwt_secret;

    let user_id_str = match user_id_from_request(&req, jwt_secret) {
        Ok(id) => id,
        Err(_) => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "ok": false,
                "error": "Unauthorized"
            }));
        }
    };

    let user_id = match Uuid::parse_str(&user_id_str) {
        Ok(id) => id,
        Err(_) => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "ok": false,
                "error": "Invalid user ID"
            }));
        }
    };

    // Получаем активную подписку
    let subscription = match subscription::get_user_active_subscription(&state.pool, &user_id).await {
        Ok(Some(s)) => s,
        Ok(None) => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "ok": false,
                "error": "У вас нет активной подписки"
            }));
        }
        Err(e) => {
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "ok": false,
                "error": e.to_string()
            }));
        }
    };

    // Отменяем подписку
    match subscription::cancel_subscription(&state.pool, &user_id, &subscription.id).await {
        Ok(()) => HttpResponse::Ok().json(serde_json::json!({
            "ok": true,
            "message": "Подписка отменена"
        })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "ok": false,
            "error": e.to_string()
        })),
    }
}

/// Продлить подписку
pub async fn renew_subscription_http(
    state: web::Data<crate::AppState>,
    req: HttpRequest,
) -> impl Responder {
    let jwt_secret = &state.jwt_secret;

    let user_id_str = match user_id_from_request(&req, jwt_secret) {
        Ok(id) => id,
        Err(_) => {
            return HttpResponse::Unauthorized().json(serde_json::json!({
                "ok": false,
                "error": "Unauthorized"
            }));
        }
    };

    let user_id = match Uuid::parse_str(&user_id_str) {
        Ok(id) => id,
        Err(_) => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "ok": false,
                "error": "Invalid user ID"
            }));
        }
    };

    // Получаем активную подписку
    let subscription = match subscription::get_user_active_subscription(&state.pool, &user_id).await {
        Ok(Some(s)) => s,
        Ok(None) => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "ok": false,
                "error": "У вас нет активной подписки"
            }));
        }
        Err(e) => {
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "ok": false,
                "error": e.to_string()
            }));
        }
    };

    // Продлеваем подписку
    match subscription::renew_subscription(&state.pool, &user_id, &subscription.id).await {
        Ok(updated) => {
            // Создаем транзакцию
            let charge_amount = if updated.billing_period == "yearly" {
                updated.total_yearly_price
            } else {
                updated.total_monthly_price
            };

            let _ = subscription::create_subscription_transaction(
                &state.pool,
                &user_id,
                Some(&updated.id),
                charge_amount,
                "charge",
                &format!("Продление подписки ({})", updated.billing_period),
            ).await;

            HttpResponse::Ok().json(serde_json::json!({
                "ok": true,
                "subscription": updated
            }))
        }
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "ok": false,
            "error": e.to_string()
        })),
    }
}
