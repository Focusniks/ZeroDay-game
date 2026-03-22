//! Модуль модульной системы подписок
//! Пользователи могут выбирать отдельные модули для подписки

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

// ==================== ТИПЫ ====================

/// Категория модуля подписки
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ModuleCategory {
    Cosmetics,
    Storage,
    Access,
    Features,
}

/// Статус подписки
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum SubscriptionStatus {
    Active,
    Cancelled,
    Expired,
}

/// Биллинг период
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum BillingPeriod {
    Monthly,
    Yearly,
}

/// Модуль подписки (каталог)
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct SubscriptionModule {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub icon: Option<String>,
    pub category: String,
    pub base_price_monthly: i32,
    pub base_price_yearly: i32,
    pub discount_percent: i32,
    pub available: bool,
    pub created_at: DateTime<Utc>,
}

/// Активная подписка пользователя
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct UserSubscription {
    pub id: Uuid,
    pub user_id: Uuid,
    pub status: String,
    pub total_monthly_price: i32,
    pub total_yearly_price: i32,
    pub billing_period: String,
    pub auto_renew: bool,
    pub started_at: DateTime<Utc>,
    pub expires_at: Option<DateTime<Utc>>,
    pub cancelled_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Выбранный модуль в подписке пользователя
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct UserSubscriptionModule {
    pub id: Uuid,
    pub subscription_id: Uuid,
    pub module_id: String,
    pub monthly_price: i32,
    pub yearly_price: i32,
    pub activated_at: DateTime<Utc>,
    pub deactivated_at: Option<DateTime<Utc>>,
}

/// Модуль подписки с информацией для клиента
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubscriptionModuleInfo {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub icon: Option<String>,
    pub category: String,
    pub price_monthly: i32,
    pub price_yearly: i32,
    pub discount_percent: i32,
    pub available: bool,
    pub selected: bool,
}

/// Информация о подписке пользователя для клиента
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserSubscriptionInfo {
    pub id: Uuid,
    pub status: String,
    pub total_monthly_price: i32,
    pub total_yearly_price: i32,
    pub billing_period: String,
    pub auto_renew: bool,
    pub started_at: DateTime<Utc>,
    pub expires_at: Option<DateTime<Utc>>,
    pub modules: Vec<SubscriptionModuleInfo>,
}

/// Транзакция подписки
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct SubscriptionTransaction {
    pub id: Uuid,
    pub user_id: Uuid,
    pub subscription_id: Option<Uuid>,
    pub amount: i32,
    pub currency: String,
    pub r#type: String,
    pub status: String,
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
    pub processed_at: Option<DateTime<Utc>>,
}

// ==================== ФУНКЦИИ ====================

/// Получить все доступные модули подписки
pub async fn get_available_modules(pool: &PgPool) -> anyhow::Result<Vec<SubscriptionModule>> {
    let modules = sqlx::query_as::<_, SubscriptionModule>(
        r#"
        SELECT * FROM subscription_modules
        WHERE available = TRUE
        ORDER BY category, base_price_monthly
        "#,
    )
    .fetch_all(pool)
    .await?;

    Ok(modules)
}

/// Получить активную подписку пользователя
pub async fn get_user_active_subscription(
    pool: &PgPool,
    user_id: &Uuid,
) -> anyhow::Result<Option<UserSubscription>> {
    let subscription = sqlx::query_as::<_, UserSubscription>(
        r#"
        SELECT * FROM user_subscriptions
        WHERE user_id = $1
        AND status = 'active'
        AND (expires_at IS NULL OR expires_at > NOW())
        "#,
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await?;

    Ok(subscription)
}

/// Получить модули подписки пользователя
pub async fn get_user_subscription_modules(
    pool: &PgPool,
    subscription_id: &Uuid,
) -> anyhow::Result<Vec<UserSubscriptionModule>> {
    let modules = sqlx::query_as::<_, UserSubscriptionModule>(
        r#"
        SELECT * FROM user_subscription_modules
        WHERE subscription_id = $1
        AND deactivated_at IS NULL
        "#,
    )
    .bind(subscription_id)
    .fetch_all(pool)
    .await?;

    Ok(modules)
}

/// Создать новую подписку для пользователя
pub async fn create_user_subscription(
    pool: &PgPool,
    user_id: &Uuid,
    billing_period: &str,
    auto_renew: bool,
) -> anyhow::Result<UserSubscription> {
    let subscription = sqlx::query_as::<_, UserSubscription>(
        r#"
        INSERT INTO user_subscriptions (user_id, billing_period, auto_renew, expires_at)
        VALUES ($1, $2, $3, NOW() + INTERVAL '30 days')
        RETURNING *
        "#,
    )
    .bind(user_id)
    .bind(billing_period)
    .bind(auto_renew)
    .fetch_one(pool)
    .await?;

    // Логируем создание подписки
    log_subscription_action(
        pool,
        user_id,
        Some(&subscription.id),
        "created",
        None,
        Some(0),
        Some(serde_json::json!({
            "billing_period": billing_period,
            "auto_renew": auto_renew
        })),
    )
    .await?;

    Ok(subscription)
}

/// Добавить модуль к подписке пользователя
pub async fn add_module_to_subscription(
    pool: &PgPool,
    subscription_id: &Uuid,
    module_id: &str,
) -> anyhow::Result<i32> {
    // Получаем информацию о модуле
    let module: Option<(i32, i32)> = sqlx::query_as(
        "SELECT base_price_monthly, base_price_yearly FROM subscription_modules WHERE id = $1 AND available = TRUE",
    )
    .bind(module_id)
    .fetch_optional(pool)
    .await?;

    let (monthly_price, yearly_price) = module.ok_or_else(|| {
        anyhow::anyhow!("Модуль недоступен или не существует")
    })?;

    // Получаем billing период подписки
    let billing_period: String = sqlx::query_scalar(
        "SELECT billing_period FROM user_subscriptions WHERE id = $1",
    )
    .bind(subscription_id)
    .fetch_one(pool)
    .await?;

    // Добавляем модуль
    sqlx::query(
        r#"
        INSERT INTO user_subscription_modules (subscription_id, module_id, monthly_price, yearly_price)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (subscription_id, module_id) WHERE deactivated_at IS NULL
        DO UPDATE SET deactivated_at = NULL, activated_at = NOW()
        "#,
    )
    .bind(subscription_id)
    .bind(module_id)
    .bind(monthly_price)
    .bind(yearly_price)
    .execute(pool)
    .await?;

    // Обновляем цену подписки (триггер сделает это автоматически)
    // Но нам нужно вернуть изменение цены для клиента
    let price_change = if billing_period == "yearly" {
        yearly_price
    } else {
        monthly_price
    };

    // Логируем действие
    log_subscription_action(
        pool,
        &sqlx::query_scalar::<_, Uuid>("SELECT user_id FROM user_subscriptions WHERE id = $1")
            .bind(subscription_id)
            .fetch_one(pool)
            .await?,
        Some(subscription_id),
        "module_added",
        Some(module_id),
        Some(price_change),
        None,
    )
    .await?;

    Ok(price_change)
}

/// Удалить модуль из подписки пользователя
pub async fn remove_module_from_subscription(
    pool: &PgPool,
    subscription_id: &Uuid,
    module_id: &str,
) -> anyhow::Result<i32> {
    // Получаем текущую цену модуля
    let module_price: Option<(i32, i32)> = sqlx::query_as(
        "SELECT monthly_price, yearly_price FROM user_subscription_modules WHERE subscription_id = $1 AND module_id = $2 AND deactivated_at IS NULL",
    )
    .bind(subscription_id)
    .bind(module_id)
    .fetch_optional(pool)
    .await?;

    let (monthly_price, yearly_price) = module_price.ok_or_else(|| {
        anyhow::anyhow!("Модуль не найден в подписке")
    })?;

    // Получаем billing период подписки
    let billing_period: String = sqlx::query_scalar(
        "SELECT billing_period FROM user_subscriptions WHERE id = $1",
    )
    .bind(subscription_id)
    .fetch_one(pool)
    .await?;

    // Деактивируем модуль
    sqlx::query(
        "UPDATE user_subscription_modules SET deactivated_at = NOW() WHERE subscription_id = $1 AND module_id = $2 AND deactivated_at IS NULL",
    )
    .bind(subscription_id)
    .bind(module_id)
    .execute(pool)
    .await?;

    // Обновляем цену подписки (триггер сделает это автоматически)
    let price_change = if billing_period == "yearly" {
        -yearly_price
    } else {
        -monthly_price
    };

    // Логируем действие
    log_subscription_action(
        pool,
        &sqlx::query_scalar::<_, Uuid>("SELECT user_id FROM user_subscriptions WHERE id = $1")
            .bind(subscription_id)
            .fetch_one(pool)
            .await?,
        Some(subscription_id),
        "module_removed",
        Some(module_id),
        Some(price_change),
        None,
    )
    .await?;

    Ok(price_change)
}

/// Отменить подписку
pub async fn cancel_subscription(
    pool: &PgPool,
    user_id: &Uuid,
    subscription_id: &Uuid,
) -> anyhow::Result<()> {
    sqlx::query(
        r#"
        UPDATE user_subscriptions
        SET status = 'cancelled', cancelled_at = NOW()
        WHERE id = $1 AND user_id = $2
        "#,
    )
    .bind(subscription_id)
    .bind(user_id)
    .execute(pool)
    .await?;

    // Логируем действие
    log_subscription_action(
        pool,
        user_id,
        Some(subscription_id),
        "cancelled",
        None,
        None,
        None,
    )
    .await?;

    Ok(())
}

/// Продлить подписку
pub async fn renew_subscription(
    pool: &PgPool,
    user_id: &Uuid,
    subscription_id: &Uuid,
) -> anyhow::Result<UserSubscription> {
    // Получаем текущую подписку
    let subscription: UserSubscription = sqlx::query_as(
        "SELECT * FROM user_subscriptions WHERE id = $1 AND user_id = $2",
    )
    .bind(subscription_id)
    .bind(user_id)
    .fetch_one(pool)
    .await?;

    // Определяем период продления
    let extend_period = if subscription.billing_period == "yearly" {
        "1 year"
    } else {
        "1 month"
    };

    // Продлеваем подписку
    let updated = sqlx::query_as::<_, UserSubscription>(
        &format!(
            r#"
            UPDATE user_subscriptions
            SET 
                status = 'active',
                expires_at = CASE 
                    WHEN expires_at > NOW() THEN expires_at + INTERVAL '{}'
                    ELSE NOW() + INTERVAL '{}'
                END,
                cancelled_at = NULL,
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
            "#,
            extend_period, extend_period
        ),
    )
    .bind(subscription_id)
    .fetch_one(pool)
    .await?;

    // Логируем действие
    log_subscription_action(
        pool,
        user_id,
        Some(subscription_id),
        "renewed",
        None,
        None,
        Some(serde_json::json!({
            "billing_period": subscription.billing_period,
            "price": if subscription.billing_period == "yearly" { subscription.total_yearly_price } else { subscription.total_monthly_price }
        })),
    )
    .await?;

    Ok(updated)
}

/// Логировать действие с подпиской
pub async fn log_subscription_action(
    pool: &PgPool,
    user_id: &Uuid,
    subscription_id: Option<&Uuid>,
    action: &str,
    module_id: Option<&str>,
    price_change: Option<i32>,
    details: Option<serde_json::Value>,
) -> anyhow::Result<()> {
    sqlx::query(
        r#"
        INSERT INTO user_subscription_history (user_id, subscription_id, action, module_id, price_change, details)
        VALUES ($1, $2, $3, $4, $5, $6)
        "#,
    )
    .bind(user_id)
    .bind(subscription_id)
    .bind(action)
    .bind(module_id)
    .bind(price_change)
    .bind(details)
    .execute(pool)
    .await?;

    Ok(())
}

/// Создать транзакцию подписки
pub async fn create_subscription_transaction(
    pool: &PgPool,
    user_id: &Uuid,
    subscription_id: Option<&Uuid>,
    amount: i32,
    transaction_type: &str,
    description: &str,
) -> anyhow::Result<SubscriptionTransaction> {
    let transaction = sqlx::query_as::<_, SubscriptionTransaction>(
        r#"
        INSERT INTO subscription_transactions (user_id, subscription_id, amount, type, description, status, processed_at)
        VALUES ($1, $2, $3, $4, $5, 'completed', NOW())
        RETURNING *
        "#,
    )
    .bind(user_id)
    .bind(subscription_id)
    .bind(amount)
    .bind(transaction_type)
    .bind(description)
    .fetch_one(pool)
    .await?;

    Ok(transaction)
}
