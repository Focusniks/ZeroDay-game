//! Мессенджер - модели и функции
//! Работает с таблицами: messenger_profiles, messenger_contacts, friend_requests,
//! conversations, conversation_members, messages, message_read_receipts

use serde::{Deserialize, Serialize};
use sqlx::{PgPool, FromRow};
use uuid::Uuid;
use chrono::{DateTime, Utc};
use serde_json::Value as JsonValue;

use crate::websocket::WsMessage;

// ==================== МОДЕЛИ ====================

/// Профиль пользователя в мессенджере
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct MessengerProfile {
    pub id: Uuid,
    pub user_id: Uuid,
    pub messenger_id: String,
    pub display_name: String,
    pub avatar_url: Option<String>,
    pub about: Option<String>,
    pub is_setup_complete: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    
    // Новые поля из migration 015
    #[sqlx(default)]
    pub custom_user_id: Option<String>,
    #[sqlx(default)]
    pub theme_settings: Option<JsonValue>,
    #[sqlx(default)]
    pub notification_settings: Option<JsonValue>,
}

/// Статус пользователя (онлайн/оффлайн)
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct UserOnlineStatus {
    pub user_id: Uuid,
    pub is_online: bool,
    pub last_seen: DateTime<Utc>,
    pub last_activity: DateTime<Utc>,
}

/// Файл сообщения
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct MessengerFile {
    pub id: Uuid,
    pub message_id: Uuid,
    pub sender_user_id: Uuid,
    pub file_name: String,
    pub file_size: i64,
    pub mime_type: String,
    pub file_type: String,
    pub storage_path: Option<String>,
    pub file_url: Option<String>,
    pub width: Option<i32>,
    pub height: Option<i32>,
    pub duration: Option<i32>,
    pub file_hash: Option<String>,
    pub created_at: DateTime<Utc>,
    pub downloaded_count: i32,
}

/// Реакция на сообщение
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct MessageReaction {
    pub id: Uuid,
    pub message_id: Uuid,
    pub user_id: Uuid,
    pub emoji: String,
    pub created_at: DateTime<Utc>,
}

/// Контакт с расширенной информацией
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ContactWithStatus {
    pub id: Uuid,
    pub contact_user_id: Uuid,
    pub contact_display_name: String,
    pub contact_messenger_id: String,
    pub contact_avatar_url: Option<String>,
    pub custom_name: Option<String>,
    pub is_online: bool,
    pub last_seen: Option<DateTime<Utc>>,
    pub last_activity: Option<DateTime<Utc>>,
    pub added_at: DateTime<Utc>,
}

/// Контакт/друг
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Contact {
    pub id: Uuid,
    pub contact_user_id: Uuid,
    pub contact_display_name: String,
    pub contact_messenger_id: String,
    pub contact_avatar_url: Option<String>,
    pub custom_name: Option<String>,
    pub is_online: bool,
    pub added_at: DateTime<Utc>,
}

/// Запрос в друзья
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct FriendRequest {
    pub id: Uuid,
    pub sender_user_id: Uuid,
    pub sender_display_name: String,
    pub sender_messenger_id: String,
    pub sender_avatar_url: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// Исходящий запрос в друзья (отправитель видит получателя)
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct OutgoingFriendRequest {
    pub id: Uuid,
    pub receiver_user_id: Uuid,
    pub receiver_display_name: String,
    pub receiver_messenger_id: String,
    pub receiver_avatar_url: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// Чат (конверсация) - упрощённая версия без nested типов
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Conversation {
    pub id: Uuid,
    pub name: Option<String>,
    pub avatar_url: Option<String>,
    pub created_by: Option<Uuid>,
    pub is_group: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Конверсация с последним сообщением (для списка)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversationWithLastMessage {
    pub id: Uuid,
    pub name: Option<String>,
    pub avatar_url: Option<String>,
    pub created_by: Option<Uuid>,
    pub is_group: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub last_message: Option<LastMessageInfo>,
    pub unread_count: i64,
    pub other_user: Option<OtherUserInfo>,
}

/// Информация о другом пользователе в чате
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct OtherUserInfo {
    pub conversation_id: Uuid,
    pub id: Uuid,
    pub username: String,
    /// Локальное имя из messenger_contacts (как вы называете контакт у себя)
    #[sqlx(default)]
    pub custom_name: Option<String>,
    pub avatar_url: Option<String>,
    pub is_online: bool,
    pub last_seen: Option<DateTime<Utc>>,
}

/// Последнее сообщение в чате
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct LastMessageInfo {
    pub id: Uuid,
    pub conversation_id: Uuid,
    pub content: String,
    pub sender_id: Uuid,
    pub sender_username: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// Сообщение
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Message {
    pub id: Uuid,
    pub conversation_id: Uuid,
    pub sender_id: Uuid,
    pub content: String,
    pub message_type: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    
    #[sqlx(default)]
    pub sender_username: Option<String>,
    
    #[sqlx(default)]
    pub is_read: bool,

    #[sqlx(default)]
    pub edited: bool,
}

// ==================== ФУНКЦИИ ====================

/// Получить профиль по user_id
pub async fn get_profile_by_user_id(pool: &PgPool, user_id: &Uuid) -> Result<Option<MessengerProfile>, sqlx::Error> {
    sqlx::query_as::<_, MessengerProfile>(
        r#"SELECT * FROM messenger_profiles WHERE user_id = $1"#
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await
}

/// Получить профиль по messenger_id
pub async fn get_profile_by_messenger_id(pool: &PgPool, messenger_id: &str) -> Result<Option<MessengerProfile>, sqlx::Error> {
    sqlx::query_as::<_, MessengerProfile>(
        r#"SELECT * FROM messenger_profiles WHERE messenger_id = $1"#
    )
    .bind(messenger_id)
    .fetch_optional(pool)
    .await
}

/// Создать профиль
pub async fn create_profile(
    pool: &PgPool,
    user_id: &Uuid,
    messenger_id: &str,
    display_name: &str,
    about: Option<&str>,
) -> Result<MessengerProfile, sqlx::Error> {
    sqlx::query_as::<_, MessengerProfile>(
        r#"
        INSERT INTO messenger_profiles (user_id, messenger_id, display_name, about, is_setup_complete)
        VALUES ($1, $2, $3, $4, true)
        RETURNING *
        "#
    )
    .bind(user_id)
    .bind(messenger_id)
    .bind(display_name)
    .bind(about)
    .fetch_one(pool)
    .await
}

/// Обновить профиль
pub async fn update_profile(
    pool: &PgPool,
    user_id: &str,
    display_name: Option<&str>,
    avatar_url: Option<&str>,
    about: Option<&str>,
) -> Result<MessengerProfile, sqlx::Error> {
    // Конвертируем user_id в Uuid
    let user_uuid = Uuid::parse_str(user_id)
        .map_err(|e| sqlx::Error::Protocol(format!("Invalid user_id: {}", e)))?;
    
    // Простой UPDATE без динамического SQL
    sqlx::query_as::<_, MessengerProfile>(
        r#"
        UPDATE messenger_profiles
        SET 
            display_name = COALESCE($2, display_name),
            avatar_url = COALESCE($3, avatar_url),
            about = COALESCE($4, about),
            updated_at = NOW()
        WHERE user_id = $1
        RETURNING *
        "#
    )
    .bind(&user_uuid)
    .bind(&display_name)
    .bind(&avatar_url)
    .bind(&about)
    .fetch_one(pool)
    .await
}

/// Поиск пользователей
pub async fn search_users(
    pool: &PgPool,
    query: &str,
    current_user_id: &str,
) -> Result<Vec<MessengerProfile>, sqlx::Error> {
    // Конвертируем current_user_id в Uuid
    let current_uuid = Uuid::parse_str(current_user_id)
        .unwrap_or(Uuid::nil());
    
    let search_pattern = format!("%{}%", query);
    
    sqlx::query_as::<_, MessengerProfile>(
        r#"
        SELECT * FROM messenger_profiles
        WHERE user_id != $1
        AND (
            LOWER(messenger_id) LIKE LOWER($2)
            OR LOWER(display_name) LIKE LOWER($2)
        )
        ORDER BY 
            CASE WHEN LOWER(messenger_id) = LOWER($2) THEN 0
                 WHEN LOWER(messenger_id) LIKE LOWER($2) THEN 1
                 ELSE 2
            END
        LIMIT 20
        "#
    )
    .bind(current_uuid)
    .bind(&search_pattern)
    .fetch_all(pool)
    .await
}

/// Отправить запрос в друзья
pub async fn send_friend_request(
    pool: &PgPool,
    sender_id: &str,
    receiver_messenger_id: &str,
) -> Result<FriendRequest, anyhow::Error> {
    // Конвертируем sender_id в Uuid
    let sender_uuid = Uuid::parse_str(sender_id)
        .map_err(|e| anyhow::anyhow!("Invalid sender_id: {}", e))?;
    
    // Находим получателя
    let receiver = get_profile_by_messenger_id(pool, receiver_messenger_id).await?
        .ok_or_else(|| anyhow::anyhow!("Пользователь не найден"))?;
    
    // Проверяем, не отправляем ли сами себе
    if receiver.user_id == sender_uuid {
        return Err(anyhow::anyhow!("Нельзя добавить себя в друзья"));
    }
    
    // Создаём запрос
    let request = sqlx::query_as::<_, FriendRequest>(
        r#"
        INSERT INTO friend_requests (sender_user_id, receiver_user_id, status)
        VALUES ($1, $2, 'pending')
        ON CONFLICT (sender_user_id, receiver_user_id) 
        DO UPDATE SET status = 'pending', created_at = NOW()
        RETURNING *
        "#
    )
    .bind(&sender_uuid)
    .bind(&receiver.user_id)
    .fetch_one(pool)
    .await?;
    
    // Добавляем контакт отправителю (pending)
    sqlx::query(
        r#"
        INSERT INTO messenger_contacts (owner_user_id, contact_user_id, status, added_by)
        VALUES ($1, $2, 'pending', $3)
        ON CONFLICT (owner_user_id, contact_user_id) DO NOTHING
        "#
    )
    .bind(&sender_uuid)
    .bind(&receiver.user_id)
    .bind(&sender_uuid)
    .execute(pool)
    .await?;
    
    Ok(request)
}

/// Получить входящие запросы в друзья
pub async fn get_incoming_friend_requests(
    pool: &PgPool,
    user_id: &str,
) -> Result<Vec<FriendRequest>, sqlx::Error> {
    // Конвертируем user_id в Uuid
    let user_uuid = Uuid::parse_str(user_id)
        .unwrap_or(Uuid::nil());
    
    sqlx::query_as::<_, FriendRequest>(
        r#"
        SELECT
            fr.id,
            fr.sender_user_id,
            COALESCE(mp.display_name, 'Unknown') as sender_display_name,
            COALESCE(mp.messenger_id, 'unknown') as sender_messenger_id,
            mp.avatar_url as sender_avatar_url,
            fr.created_at
        FROM friend_requests fr
        JOIN messenger_profiles mp ON mp.user_id = fr.sender_user_id
        WHERE fr.receiver_user_id = $1 AND fr.status = 'pending'
        ORDER BY fr.created_at DESC
        "#
    )
    .bind(&user_uuid)
    .fetch_all(pool)
    .await
}

/// Исходящие запросы в друзья (ожидают ответа)
pub async fn get_outgoing_friend_requests(
    pool: &PgPool,
    user_id: &str,
) -> Result<Vec<OutgoingFriendRequest>, sqlx::Error> {
    let user_uuid = Uuid::parse_str(user_id).unwrap_or(Uuid::nil());

    sqlx::query_as::<_, OutgoingFriendRequest>(
        r#"
        SELECT
            fr.id,
            fr.receiver_user_id,
            COALESCE(mp.display_name, 'Unknown') as receiver_display_name,
            COALESCE(mp.messenger_id, 'unknown') as receiver_messenger_id,
            mp.avatar_url as receiver_avatar_url,
            fr.created_at
        FROM friend_requests fr
        JOIN messenger_profiles mp ON mp.user_id = fr.receiver_user_id
        WHERE fr.sender_user_id = $1 AND fr.status = 'pending'
        ORDER BY fr.created_at DESC
        "#,
    )
    .bind(&user_uuid)
    .fetch_all(pool)
    .await
}

/// Отменить свой исходящий запрос в друзья
pub async fn cancel_friend_request(
    pool: &PgPool,
    sender_id: &str,
    request_id: &Uuid,
) -> Result<(), anyhow::Error> {
    let sender_uuid = Uuid::parse_str(sender_id)
        .map_err(|e| anyhow::anyhow!("Invalid sender_id: {}", e))?;

    let mut tx = pool.begin().await?;

    let receiver_id: Option<Uuid> = sqlx::query_scalar::<_, Uuid>(
        r#"
        SELECT receiver_user_id FROM friend_requests
        WHERE id = $1 AND sender_user_id = $2 AND status = 'pending'
        "#,
    )
    .bind(request_id)
    .bind(&sender_uuid)
    .fetch_optional(&mut *tx)
    .await?;

    let receiver_id = receiver_id.ok_or_else(|| anyhow::anyhow!("Запрос не найден"))?;

    sqlx::query("DELETE FROM friend_requests WHERE id = $1")
        .bind(request_id)
        .execute(&mut *tx)
        .await?;

    sqlx::query(
        r#"
        DELETE FROM messenger_contacts
        WHERE owner_user_id = $1 AND contact_user_id = $2 AND status = 'pending'
        "#,
    )
    .bind(&sender_uuid)
    .bind(&receiver_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(())
}

/// Ответить на запрос в друзья
pub async fn respond_to_friend_request(
    pool: &PgPool,
    user_id: &str,
    request_id: &Uuid,
    accept: bool,
) -> Result<(), anyhow::Error> {
    // Конвертируем user_id в Uuid
    let user_uuid = Uuid::parse_str(user_id)
        .map_err(|e| anyhow::anyhow!("Invalid user_id: {}", e))?;
    
    let mut tx = pool.begin().await?;
    
    // Проверяем что запрос на наше имя
    let request = sqlx::query_scalar::<_, Uuid>(
        "SELECT sender_user_id FROM friend_requests WHERE id = $1 AND receiver_user_id = $2 AND status = 'pending'"
    )
    .bind(request_id)
    .bind(&user_uuid)
    .fetch_optional(&mut *tx)
    .await?;
    
    if request.is_none() {
        return Err(anyhow::anyhow!("Запрос не найден"));
    }
    
    let sender_id = request.unwrap();
    
    // Обновляем статус запроса
    let status = if accept { "accepted" } else { "declined" };
    sqlx::query(
        "UPDATE friend_requests SET status = $1, responded_at = NOW() WHERE id = $2"
    )
    .bind(status)
    .bind(request_id)
    .execute(&mut *tx)
    .await?;
    
    if accept {
        // Добавляем взаимные контакты
        sqlx::query(
            r#"
            INSERT INTO messenger_contacts (owner_user_id, contact_user_id, status, added_by)
            VALUES ($1, $2, 'accepted', $3)
            ON CONFLICT (owner_user_id, contact_user_id) 
            DO UPDATE SET status = 'accepted'
            "#
        )
        .bind(&user_uuid)
        .bind(&sender_id)
        .bind(&user_uuid)
        .execute(&mut *tx)
        .await?;
        
        sqlx::query(
            r#"
            INSERT INTO messenger_contacts (owner_user_id, contact_user_id, status, added_by)
            VALUES ($1, $2, 'accepted', $3)
            ON CONFLICT (owner_user_id, contact_user_id) 
            DO UPDATE SET status = 'accepted'
            "#
        )
        .bind(&sender_id)
        .bind(&user_uuid)
        .bind(&user_uuid)
        .execute(&mut *tx)
        .await?;
        
        // Гарантируем ровно один личный чат на пару пользователей.
        let existing_conv_id = sqlx::query_scalar::<_, Uuid>(
            r#"
            SELECT c.id
            FROM conversations c
            JOIN conversation_members cm1 ON cm1.conversation_id = c.id AND cm1.user_id = $1
            JOIN conversation_members cm2 ON cm2.conversation_id = c.id AND cm2.user_id = $2
            WHERE c.is_group = false
              AND (SELECT COUNT(*) FROM conversation_members cm WHERE cm.conversation_id = c.id) = 2
            LIMIT 1
            "#
        )
        .bind(&user_uuid)
        .bind(&sender_id)
        .fetch_optional(&mut *tx)
        .await?;

        if existing_conv_id.is_none() {
            let conv_id = sqlx::query_scalar::<_, Uuid>(
                r#"
                INSERT INTO conversations (created_by, is_group, created_at, updated_at)
                VALUES ($1, false, NOW(), NOW())
                RETURNING id
                "#
            )
            .bind(&user_uuid)
            .fetch_one(&mut *tx)
            .await?;

            sqlx::query(
                "INSERT INTO conversation_members (conversation_id, user_id, role) VALUES ($1, $2, 'member')"
            )
            .bind(&conv_id)
            .bind(&user_uuid)
            .execute(&mut *tx)
            .await?;

            sqlx::query(
                "INSERT INTO conversation_members (conversation_id, user_id, role) VALUES ($1, $2, 'member')"
            )
            .bind(&conv_id)
            .bind(&sender_id)
            .execute(&mut *tx)
            .await?;
        }
    }
    
    tx.commit().await?;
    Ok(())
}

/// Получить контакты
pub async fn get_contacts(
    pool: &PgPool,
    user_id: &str,
) -> Result<Vec<Contact>, sqlx::Error> {
    // Конвертируем user_id в Uuid
    let user_uuid = Uuid::parse_str(user_id)
        .unwrap_or(Uuid::nil());
    
    sqlx::query_as::<_, Contact>(
        r#"
        SELECT 
            mc.id,
            mc.contact_user_id,
            mp.display_name as contact_display_name,
            mp.messenger_id as contact_messenger_id,
            mp.avatar_url as contact_avatar_url,
            mc.custom_name,
            false as is_online,
            mc.created_at as added_at
        FROM messenger_contacts mc
        JOIN messenger_profiles mp ON mp.user_id = mc.contact_user_id
        WHERE mc.owner_user_id = $1 AND mc.status = 'accepted'
        ORDER BY COALESCE(mc.custom_name, mp.display_name)
        "#
    )
    .bind(&user_uuid)
    .fetch_all(pool)
    .await
}

/// Удалить контакт
pub async fn remove_contact(
    pool: &PgPool,
    owner_id: &str,
    contact_id: &str,
) -> Result<(), sqlx::Error> {
    // Конвертируем ID в Uuid
    let owner_uuid = Uuid::parse_str(owner_id)
        .map_err(|e| sqlx::Error::Protocol(format!("Invalid owner_id: {}", e)))?;
    let contact_uuid = Uuid::parse_str(contact_id)
        .map_err(|e| sqlx::Error::Protocol(format!("Invalid contact_id: {}", e)))?;
    
    sqlx::query(
        "DELETE FROM messenger_contacts WHERE owner_user_id = $1 AND contact_user_id = $2"
    )
    .bind(&owner_uuid)
    .bind(&contact_uuid)
    .execute(pool)
    .await?;
    Ok(())
}

/// Получить конверсации пользователя (с последними сообщениями)
/// Оптимизированная версия с batch запросами
/// Сортировка по времени последнего сообщения
pub async fn get_user_conversations(
    pool: &PgPool,
    user_id: &str,
) -> Result<Vec<ConversationWithLastMessage>, sqlx::Error> {
    let user_uuid = Uuid::parse_str(user_id)
        .unwrap_or(Uuid::nil());

    // Получаем все конверсации с временем последнего сообщения через подзапрос
    let conversations = sqlx::query_as::<_, Conversation>(
        r#"
        SELECT 
            c.id, c.name, c.avatar_url, c.created_by, c.is_group,
            COALESCE(lm.last_message_at, c.created_at) as created_at,
            COALESCE(lm.last_message_at, c.updated_at) as updated_at
        FROM conversations c
        JOIN conversation_members cm ON c.id = cm.conversation_id
        LEFT JOIN LATERAL (
            SELECT MAX(m.created_at) as last_message_at
            FROM messages m
            WHERE m.conversation_id = c.id AND m.deleted = false
        ) lm ON true
        WHERE cm.user_id = $1
        ORDER BY COALESCE(lm.last_message_at, c.created_at) DESC
        LIMIT 100
        "#
    )
    .bind(&user_uuid)
    .fetch_all(pool)
    .await?;

    if conversations.is_empty() {
        return Ok(vec![]);
    }

    // Собираем все conversation_id для batch запросов
    let conv_ids: Vec<Uuid> = conversations.iter().map(|c| c.id).collect();

    // Получаем последние сообщения для всех чатов одним запросом
    let last_messages = sqlx::query_as::<_, LastMessageInfo>(
        r#"
        SELECT DISTINCT ON (m.conversation_id)
            m.id, m.conversation_id, m.content, m.sender_id,
            mp.messenger_id as sender_username, m.created_at
        FROM messages m
        LEFT JOIN messenger_profiles mp ON mp.user_id = m.sender_id
        WHERE m.conversation_id = ANY($1) AND m.deleted = false
        ORDER BY m.conversation_id, m.created_at DESC
        "#
    )
    .bind(&conv_ids)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    // Получаем unread count для всех чатов одним запросом
    let unread_counts = sqlx::query_scalar::<_, (Uuid, i64)>(
        r#"
        SELECT m.conversation_id, COUNT(*)::bigint as unread_count
        FROM messages m
        LEFT JOIN message_read_receipts mrr ON mrr.message_id = m.id AND mrr.user_id = $1
        WHERE m.conversation_id = ANY($2)
        AND m.sender_id != $1
        AND mrr.message_id IS NULL
        AND m.deleted = false
        GROUP BY m.conversation_id
        "#
    )
    .bind(&user_uuid)
    .bind(&conv_ids)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let unread_map: std::collections::HashMap<Uuid, i64> = unread_counts.into_iter().collect();

    // Получаем других пользователей для личных чатов с last_seen
    let other_users = sqlx::query_as::<_, OtherUserInfo>(
        r#"
        SELECT 
            cm.conversation_id,
            u.id,
            COALESCE(mp.display_name, u.username) as username,
            mc.custom_name as custom_name,
            mp.avatar_url as avatar_url,
            COALESCE(uos.is_online, false) as is_online,
            uos.last_seen
        FROM conversation_members cm
        JOIN users u ON u.id = cm.user_id
        LEFT JOIN messenger_profiles mp ON mp.user_id = u.id
        LEFT JOIN messenger_contacts mc ON mc.owner_user_id = $2 AND mc.contact_user_id = u.id
        LEFT JOIN user_online_status uos ON uos.user_id = u.id
        WHERE cm.conversation_id = ANY($1)
        AND cm.user_id != $2
        AND (
            SELECT COUNT(*) FROM conversation_members cm2
            WHERE cm2.conversation_id = cm.conversation_id
        ) = 2
        "#
    )
    .bind(&conv_ids)
    .bind(&user_uuid)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let other_user_map: std::collections::HashMap<Uuid, OtherUserInfo> = 
        other_users.into_iter()
            .map(|u| (u.conversation_id, u))
            .collect();

    // Сопоставляем сообщения с конверсациями
    let last_msg_map: std::collections::HashMap<Uuid, LastMessageInfo> = last_messages
        .into_iter()
        .map(|lm| (lm.conversation_id, lm))
        .collect();

    // Формируем результат
    let mut result: Vec<ConversationWithLastMessage> = conversations
        .into_iter()
        .map(|conv| {
            let last_message = last_msg_map.get(&conv.id).cloned();
            let unread_count = *unread_map.get(&conv.id).unwrap_or(&0);
            let other_user = if conv.is_group {
                None
            } else {
                other_user_map.get(&conv.id).map(|ou| OtherUserInfo {
                    id: ou.id,
                    username: ou.username.clone(),
                    custom_name: ou.custom_name.clone(),
                    avatar_url: ou.avatar_url.clone(),
                    is_online: ou.is_online,
                    conversation_id: ou.conversation_id,
                    last_seen: ou.last_seen,
                })
            };

            ConversationWithLastMessage {
                id: conv.id,
                name: conv.name,
                avatar_url: conv.avatar_url,
                created_by: conv.created_by,
                is_group: conv.is_group,
                created_at: conv.created_at,
                updated_at: conv.updated_at,
                last_message,
                unread_count,
                other_user,
            }
        })
        .collect();

    // Сортируем по времени последнего сообщения (updated_at)
    result.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));

    Ok(result)
}

/// Получить сообщения конверсации (с пагинацией по before)
pub async fn fetch_conversation_messages(
    pool: &PgPool,
    conversation_id: &str,
    user_id: &str,
    limit: i32,
    before: Option<DateTime<Utc>>,
) -> Result<Vec<Message>, sqlx::Error> {
    let conv_uuid = Uuid::parse_str(conversation_id)
        .map_err(|e| sqlx::Error::Protocol(format!("Invalid conversation_id: {}", e)))?;
    let user_uuid = Uuid::parse_str(user_id).unwrap_or(Uuid::nil());

    match before {
        Some(before_ts) => {
            sqlx::query_as::<_, Message>(
                r#"
                SELECT m.id, m.conversation_id, m.sender_id, m.content, m.message_type,
                    m.created_at, m.updated_at,
                    mp.messenger_id as sender_username,
                    EXISTS(SELECT 1 FROM message_read_receipts mrr WHERE mrr.message_id = m.id AND mrr.user_id = $2) as is_read,
                    m.edited
                FROM messages m
                LEFT JOIN messenger_profiles mp ON mp.user_id = m.sender_id
                WHERE m.conversation_id = $3 AND m.deleted = false AND m.created_at < $4
                ORDER BY m.created_at DESC
                LIMIT $1
                "#,
            )
            .bind(limit)
            .bind(&user_uuid)
            .bind(&conv_uuid)
            .bind(before_ts)
            .fetch_all(pool)
            .await
        }
        None => {
            sqlx::query_as::<_, Message>(
                r#"
                SELECT m.id, m.conversation_id, m.sender_id, m.content, m.message_type,
                    m.created_at, m.updated_at,
                    mp.messenger_id as sender_username,
                    EXISTS(SELECT 1 FROM message_read_receipts mrr WHERE mrr.message_id = m.id AND mrr.user_id = $2) as is_read,
                    m.edited
                FROM messages m
                LEFT JOIN messenger_profiles mp ON mp.user_id = m.sender_id
                WHERE m.conversation_id = $3 AND m.deleted = false
                ORDER BY m.created_at DESC
                LIMIT $1
                "#,
            )
            .bind(limit)
            .bind(&user_uuid)
            .bind(&conv_uuid)
            .fetch_all(pool)
            .await
        }
    }
}

/// Получить сообщения (wrapper)
pub async fn get_conversation_messages(
    pool: &PgPool,
    conversation_id: &str,
    user_id: &str,
    limit: i32,
    before: Option<DateTime<Utc>>,
) -> Result<Vec<Message>, sqlx::Error> {
    fetch_conversation_messages(pool, conversation_id, user_id, limit, before).await
}

/// Отметить сообщения как прочитанные
pub async fn mark_messages_read_internal(
    pool: &PgPool,
    conversation_id: &str,
    user_id: &str,
) -> Result<(), sqlx::Error> {
    // Конвертируем conversation_id в Uuid
    let conv_uuid = Uuid::parse_str(conversation_id)
        .map_err(|e| sqlx::Error::Protocol(format!("Invalid conversation_id: {}", e)))?;
    
    // Конвертируем user_id в Uuid
    let user_uuid = Uuid::parse_str(user_id)
        .unwrap_or(Uuid::nil());

    // Получаем все непрочитанные сообщения
    let messages = sqlx::query_scalar::<_, Uuid>(
        r#"
        SELECT m.id FROM messages m
        LEFT JOIN message_read_receipts mrr ON mrr.message_id = m.id AND mrr.user_id = $1
        WHERE m.conversation_id = $2 AND m.sender_id != $1 AND mrr.message_id IS NULL
        "#
    )
    .bind(&user_uuid)
    .bind(&conv_uuid)
    .fetch_all(pool)
    .await?;

    // Добавляем read receipts
    for msg_id in messages {
        sqlx::query(
            "INSERT INTO message_read_receipts (message_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING"
        )
        .bind(&msg_id)
        .bind(&user_uuid)
        .execute(pool)
        .await?;
    }

    Ok(())
}

/// Отметить как прочитанное (wrapper)
pub async fn mark_messages_as_read(
    pool: &PgPool,
    user_id: &str,
    conversation_id: &str,
    _message_ids: &[String],
) -> Result<(), sqlx::Error> {
    mark_messages_read_internal(pool, conversation_id, user_id).await
}

/// Создать конверсацию
pub async fn create_conversation(
    pool: &PgPool,
    creator_id: &str,
    member_ids: Vec<String>,
    name: Option<String>,
    is_group: bool,
) -> Result<Conversation, anyhow::Error> {
    // Для личного чата ищем существующий 1:1 и не создаём дубликаты.
    if !is_group {
        let creator_uuid = Uuid::parse_str(creator_id)
            .map_err(|e| anyhow::anyhow!("Invalid creator_id: {}", e))?;
        let target_uuid = member_ids
            .iter()
            .filter_map(|id| Uuid::parse_str(id).ok())
            .find(|id| *id != creator_uuid)
            .ok_or_else(|| anyhow::anyhow!("Direct conversation requires exactly one contact"))?;

        let existing_conv_id = sqlx::query_scalar::<_, Uuid>(
            r#"
            SELECT c.id
            FROM conversations c
            JOIN conversation_members cm1 ON cm1.conversation_id = c.id AND cm1.user_id = $1
            JOIN conversation_members cm2 ON cm2.conversation_id = c.id AND cm2.user_id = $2
            WHERE c.is_group = false
              AND (SELECT COUNT(*) FROM conversation_members cm WHERE cm.conversation_id = c.id) = 2
            LIMIT 1
            "#
        )
        .bind(&creator_uuid)
        .bind(&target_uuid)
        .fetch_optional(pool)
        .await?;

        if let Some(conv_id) = existing_conv_id {
            let conv = get_conversation_by_id(pool, &conv_id, creator_id).await?;
            return conv.ok_or_else(|| anyhow::anyhow!("Conversation not found"));
        }
    }

    let mut tx = pool.begin().await?;
    
    // Конвертируем creator_id в Uuid
    let creator_uuid = Uuid::parse_str(creator_id)
        .map_err(|e| anyhow::anyhow!("Invalid creator_id: {}", e))?;
    
    // Создаём конверсацию
    let conv_id = sqlx::query_scalar::<_, Uuid>(
        r#"
        INSERT INTO conversations (name, created_by, is_group, created_at, updated_at)
        VALUES ($1, $2, $3, NOW(), NOW())
        RETURNING id
        "#
    )
    .bind(&name)
    .bind(&creator_uuid)
    .bind(is_group)
    .fetch_one(&mut *tx)
    .await?;
    
    // Добавляем создателя
    sqlx::query(
        "INSERT INTO conversation_members (conversation_id, user_id, role) VALUES ($1, $2, 'admin')"
    )
    .bind(&conv_id)
    .bind(&creator_uuid)
    .execute(&mut *tx)
    .await?;
    
    // Добавляем остальных участников
    for member_id_str in member_ids {
        if let Ok(member_uuid) = Uuid::parse_str(&member_id_str) {
            if member_uuid != creator_uuid {
                sqlx::query(
                    "INSERT INTO conversation_members (conversation_id, user_id, role) VALUES ($1, $2, 'member')"
                )
                .bind(&conv_id)
                .bind(&member_uuid)
                .execute(&mut *tx)
                .await?;
            }
        }
    }
    
    tx.commit().await?;

    // Возвращаем конверсацию
    let conv = get_conversation_by_id(pool, &conv_id, creator_id).await?;
    conv.ok_or_else(|| anyhow::anyhow!("Conversation not found"))
}

/// Получить конверсацию по ID
pub async fn get_conversation_by_id(
    pool: &PgPool,
    conversation_id: &Uuid,
    current_user_id: &str,
) -> Result<Option<Conversation>, sqlx::Error> {
    // Конвертируем current_user_id в Uuid
    let user_uuid = Uuid::parse_str(current_user_id)
        .unwrap_or(Uuid::nil());
    
    sqlx::query_as::<_, Conversation>(
        r#"
        SELECT c.id, c.name, c.avatar_url, c.created_by, c.is_group, c.created_at, c.updated_at
        FROM conversations c
        JOIN conversation_members cm ON c.id = cm.conversation_id
        WHERE c.id = $1 AND cm.user_id = $2
        "#
    )
    .bind(conversation_id)
    .bind(&user_uuid)
    .fetch_optional(pool)
    .await
}

/// Отправить сообщение (полная версия)
pub async fn send_message_full(
    pool: &PgPool,
    sender_id: &str,
    conversation_id: &str,
    content: &str,
    message_type: Option<String>,
    media_url: Option<String>,
    reply_to_id: Option<String>,
) -> Result<Message, sqlx::Error> {
    // Конвертируем ID в Uuid
    let sender_uuid = Uuid::parse_str(sender_id)
        .map_err(|e| sqlx::Error::Protocol(format!("Invalid sender_id: {}", e)))?;
    let conv_uuid = Uuid::parse_str(conversation_id)
        .map_err(|e| sqlx::Error::Protocol(format!("Invalid conversation_id: {}", e)))?;

    // Конвертируем reply_to_id в Uuid если есть
    let reply_uuid = reply_to_id
        .filter(|s| !s.is_empty())
        .and_then(|s| Uuid::parse_str(&s).ok());

    let msg_type = message_type.unwrap_or_else(|| "text".to_string());

    sqlx::query_as::<_, Message>(
        r#"
        INSERT INTO messages (conversation_id, sender_id, content, message_type, media_url, reply_to_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING
            id, conversation_id, sender_id, content, message_type,
            created_at, updated_at,
            (SELECT mp.messenger_id FROM messenger_profiles mp WHERE mp.user_id = sender_id) as sender_username,
            false as is_read,
            false as edited
        "#
    )
    .bind(&conv_uuid)
    .bind(&sender_uuid)
    .bind(content)
    .bind(&msg_type)
    .bind(&media_url)
    .bind(&reply_uuid)
    .fetch_one(pool)
    .await
}

/// Одно сообщение для ленты (viewer — для флага прочтения).
pub async fn fetch_message_by_id_for_viewer(
    pool: &PgPool,
    message_id: &Uuid,
    viewer_user_id: &str,
) -> Result<Option<Message>, sqlx::Error> {
    let viewer_uuid = Uuid::parse_str(viewer_user_id).unwrap_or(Uuid::nil());
    sqlx::query_as::<_, Message>(
        r#"
        SELECT m.id, m.conversation_id, m.sender_id, m.content, m.message_type,
            m.created_at, m.updated_at,
            mp.messenger_id as sender_username,
            EXISTS(SELECT 1 FROM message_read_receipts mrr WHERE mrr.message_id = m.id AND mrr.user_id = $2) as is_read,
            m.edited
        FROM messages m
        LEFT JOIN messenger_profiles mp ON mp.user_id = m.sender_id
        WHERE m.id = $1 AND m.deleted = false
        "#,
    )
    .bind(message_id)
    .bind(&viewer_uuid)
    .fetch_optional(pool)
    .await
}

/// Мягкое удаление (только автор сообщения).
pub async fn soft_delete_message(
    pool: &PgPool,
    message_id: &str,
    user_id: &str,
) -> Result<Option<Uuid>, sqlx::Error> {
    let mid = Uuid::parse_str(message_id)
        .map_err(|e| sqlx::Error::Protocol(format!("Invalid message_id: {}", e)))?;
    let uid = Uuid::parse_str(user_id)
        .map_err(|e| sqlx::Error::Protocol(format!("Invalid user_id: {}", e)))?;
    sqlx::query_scalar::<_, Uuid>(
        r#"
        UPDATE messages SET deleted = true, updated_at = NOW()
        WHERE id = $1 AND sender_id = $2 AND deleted = false
        RETURNING conversation_id
        "#,
    )
    .bind(mid)
    .bind(uid)
    .fetch_optional(pool)
    .await
}

/// Редактирование текста (только автор, не удалённые).
pub async fn edit_message_content(
    pool: &PgPool,
    message_id: &str,
    sender_user_id: &str,
    new_content: &str,
    viewer_user_id: &str,
) -> Result<Option<Message>, sqlx::Error> {
    let trimmed = new_content.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }
    let mid = Uuid::parse_str(message_id)
        .map_err(|e| sqlx::Error::Protocol(format!("Invalid message_id: {}", e)))?;
    let sender = Uuid::parse_str(sender_user_id)
        .map_err(|e| sqlx::Error::Protocol(format!("Invalid user_id: {}", e)))?;
    let content: String = trimmed.chars().take(8000).collect();
    let n = sqlx::query(
        r#"
        UPDATE messages SET content = $1, edited = true, updated_at = NOW()
        WHERE id = $2 AND sender_id = $3 AND deleted = false
        "#,
    )
    .bind(&content)
    .bind(mid)
    .bind(sender)
    .execute(pool)
    .await?;
    if n.rows_affected() == 0 {
        return Ok(None);
    }
    fetch_message_by_id_for_viewer(pool, &mid, viewer_user_id).await
}

/// Транслировать JSON всем участникам конверсации, кроме `exclude_user_id`.
/// `with_conversations_list`: для каждого получателя один раз подтянуть список чатов (дорого — только если нужно).
/// Не держим блокировку `connections` во время запросов к БД.
pub async fn broadcast_to_conversation(
    connections: &crate::websocket::SharedConnections,
    conversation_id: &str,
    pool: &PgPool,
    message_json: &str,
    exclude_user_id: &str,
    with_conversations_list: bool,
) {
    let Some(conv_uuid) = Uuid::parse_str(conversation_id).ok() else {
        return;
    };

    let member_ids: Vec<String> = sqlx::query_scalar(
        "SELECT user_id::text FROM conversation_members WHERE conversation_id = $1",
    )
    .bind(&conv_uuid)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let targets: Vec<(String, Vec<tokio::sync::mpsc::UnboundedSender<String>>)> = {
        let conns = connections.read().await;
        member_ids
            .into_iter()
            .filter(|m| m != exclude_user_id)
            .filter_map(|m| {
                conns.get(&m).map(|entries| {
                    let txs: Vec<_> = entries.iter().map(|(_, tx)| tx.clone()).collect();
                    (m, txs)
                })
            })
            .collect()
    };

    for (member_id, txs) in targets {
        let conversations_json = if with_conversations_list {
            get_user_conversations(pool, &member_id)
                .await
                .ok()
                .and_then(|c| serde_json::to_string(&WsMessage::ConversationsList { conversations: c }).ok())
        } else {
            None
        };
        for tx in txs {
            let _ = tx.send(message_json.to_string());
            if let Some(ref json) = conversations_json {
                let _ = tx.send(json.clone());
            }
        }
    }
}

/// Транслировать два JSON-сообщения всем участникам конверсации, кроме `exclude_user_id`.
/// Используется для отправки MessageReceived + ConversationUpdate одновременно.
pub async fn broadcast_to_conversation_with_extra(
    connections: &crate::websocket::SharedConnections,
    conversation_id: &str,
    pool: &PgPool,
    message_json: &str,
    extra_json: &str,
    exclude_user_id: &str,
) {
    let Some(conv_uuid) = Uuid::parse_str(conversation_id).ok() else {
        return;
    };

    let member_ids: Vec<String> = sqlx::query_scalar(
        "SELECT user_id::text FROM conversation_members WHERE conversation_id = $1",
    )
    .bind(&conv_uuid)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let targets: Vec<(String, Vec<tokio::sync::mpsc::UnboundedSender<String>>)> = {
        let conns = connections.read().await;
        member_ids
            .into_iter()
            .filter(|m| m != exclude_user_id)
            .filter_map(|m| {
                conns.get(&m).map(|entries| {
                    let txs: Vec<_> = entries.iter().map(|(_, tx)| tx.clone()).collect();
                    (m, txs)
                })
            })
            .collect()
    };

    for (_member_id, txs) in targets {
        for tx in txs {
            let _ = tx.send(message_json.to_string());
            let _ = tx.send(extra_json.to_string());
        }
    }
}

/// Setup профиль (переименованная create_profile)
pub async fn setup_messenger_profile(
    pool: &PgPool,
    user_id: &str,
    messenger_id: &str,
    display_name: &str,
    about: Option<&str>,
) -> Result<MessengerProfile, anyhow::Error> {
    // Конвертируем user_id в Uuid
    let user_uuid = Uuid::parse_str(user_id)
        .map_err(|e| anyhow::anyhow!("Invalid user_id: {}", e))?;
    
    // Проверяем занятость messenger_id
    let exists = sqlx::query_scalar::<_, bool>(
        r#"SELECT EXISTS(SELECT 1 FROM messenger_profiles WHERE messenger_id = $1)"#
    )
    .bind(messenger_id)
    .fetch_one(pool)
    .await?;

    if exists {
        return Err(anyhow::anyhow!("Это имя уже занято"));
    }

    create_profile(pool, &user_uuid, messenger_id, display_name, about).await
        .map_err(|e| anyhow::anyhow!(e.to_string()))
}

/// Алиасы для совместимости
pub async fn get_messenger_profile(pool: &PgPool, user_id: &str) -> Result<Option<MessengerProfile>, sqlx::Error> {
    // Конвертируем user_id в Uuid
    let user_uuid = Uuid::parse_str(user_id).ok();
    if let Some(uuid) = user_uuid {
        get_profile_by_user_id(pool, &uuid).await
    } else {
        Ok(None)
    }
}

pub async fn update_messenger_profile(
    pool: &PgPool,
    user_id: &str,
    display_name: Option<&str>,
    avatar_url: Option<&str>,
    about: Option<&str>,
) -> Result<MessengerProfile, sqlx::Error> {
    update_profile(pool, user_id, display_name, avatar_url, about).await
}

// ==================== WRAPPER ФУНКЦИИ ДЛЯ СОВМЕСТИМОСТИ ====================

/// Отправить сообщение (wrapper для старой сигнатуры)
pub async fn send_message(
    pool: &PgPool,
    sender_id: &str,
    conversation_id: &str,
    content: &str,
    _message_type: Option<String>,
    _media_url: Option<String>,
    _reply_to_id: Option<String>,
) -> Result<Message, sqlx::Error> {
    send_message_full(pool, sender_id, conversation_id, content, None, None, None).await
}

// ==================== ОНЛАЙН СТАТУС ====================

/// Обновить статус онлайн пользователя
pub async fn set_user_online(pool: &PgPool, user_id: &str, is_online: bool) -> Result<(), sqlx::Error> {
    let user_uuid = Uuid::parse_str(user_id)
        .map_err(|e| sqlx::Error::Protocol(format!("Invalid user_id: {}", e)))?;
    
    sqlx::query(
        r#"
        INSERT INTO user_online_status (user_id, is_online, last_seen, last_activity)
        VALUES ($1, $2, NOW(), NOW())
        ON CONFLICT (user_id) DO UPDATE SET
            is_online = $2,
            last_activity = NOW(),
            last_seen = CASE WHEN $2 THEN user_online_status.last_seen ELSE NOW() END
        "#
    )
    .bind(&user_uuid)
    .bind(is_online)
    .execute(pool)
    .await?;
    
    Ok(())
}

/// Получить статус онлайн пользователя
pub async fn get_user_online_status(pool: &PgPool, user_id: &str) -> Result<Option<UserOnlineStatus>, sqlx::Error> {
    let user_uuid = Uuid::parse_str(user_id)
        .map_err(|e| sqlx::Error::Protocol(format!("Invalid user_id: {}", e)))?;
    
    sqlx::query_as::<_, UserOnlineStatus>(
        "SELECT * FROM user_online_status WHERE user_id = $1"
    )
    .bind(&user_uuid)
    .fetch_optional(pool)
    .await
}

/// Получить статусы онлайн для нескольких пользователей
pub async fn get_users_online_status(pool: &PgPool, user_ids: &[String]) -> Result<Vec<UserOnlineStatus>, sqlx::Error> {
    let uuids: Vec<Uuid> = user_ids
        .iter()
        .filter_map(|id| Uuid::parse_str(id).ok())
        .collect();
    
    if uuids.is_empty() {
        return Ok(vec![]);
    }
    
    sqlx::query_as::<_, UserOnlineStatus>(
        "SELECT * FROM user_online_status WHERE user_id = ANY($1)"
    )
    .bind(&uuids)
    .fetch_all(pool)
    .await
}

/// Обновить последнюю активность пользователя
pub async fn update_user_activity(pool: &PgPool, user_id: &str) -> Result<(), sqlx::Error> {
    let user_uuid = Uuid::parse_str(user_id)
        .map_err(|e| sqlx::Error::Protocol(format!("Invalid user_id: {}", e)))?;
    
    sqlx::query(
        r#"
        INSERT INTO user_online_status (user_id, is_online, last_seen, last_activity)
        VALUES ($1, TRUE, NOW(), NOW())
        ON CONFLICT (user_id) DO UPDATE SET
            last_activity = NOW(),
            is_online = TRUE
        "#
    )
    .bind(&user_uuid)
    .execute(pool)
    .await?;
    
    Ok(())
}

// ==================== НАСТРОЙКИ ПРОФИЛЯ ====================

/// Обновить настройки профиля (кастомный user_id, avatar, display_name)
pub async fn update_profile_settings(
    pool: &PgPool,
    user_id: &str,
    display_name: Option<&str>,
    avatar_url: Option<&str>,
    about: Option<&str>,
    custom_user_id: Option<&str>,
) -> Result<MessengerProfile, anyhow::Error> {
    let user_uuid = Uuid::parse_str(user_id)
        .map_err(|e| anyhow::anyhow!("Invalid user_id: {}", e))?;
    
    // Проверяем занятость custom_user_id если он указан
    if let Some(custom_id) = custom_user_id {
        if !custom_id.is_empty() {
            let exists = sqlx::query_scalar::<_, bool>(
                r#"SELECT EXISTS(SELECT 1 FROM messenger_profiles WHERE custom_user_id = $1 AND user_id != $2)"#
            )
            .bind(custom_id)
            .bind(&user_uuid)
            .fetch_one(pool)
            .await?;
            
            if exists {
                return Err(anyhow::anyhow!("Этот пользовательский ID уже занят"));
            }
        }
    }
    
    // Обновляем профиль
    let profile = sqlx::query_as::<_, MessengerProfile>(
        r#"
        UPDATE messenger_profiles
        SET
            display_name = COALESCE($2, display_name),
            avatar_url = COALESCE($3, avatar_url),
            about = COALESCE($4, about),
            custom_user_id = CASE WHEN $5 = '' THEN NULL ELSE COALESCE($5, custom_user_id) END,
            updated_at = NOW()
        WHERE user_id = $1
        RETURNING *
        "#
    )
    .bind(&user_uuid)
    .bind(&display_name)
    .bind(&avatar_url)
    .bind(&about)
    .bind(&custom_user_id)
    .fetch_one(pool)
    .await
    .map_err(|e| anyhow::anyhow!("Failed to update profile: {}", e))?;
    
    Ok(profile)
}

/// Загрузить файл сообщения
pub async fn upload_message_file(
    pool: &PgPool,
    message_id: &str,
    sender_id: &str,
    file_name: &str,
    file_size: i64,
    mime_type: &str,
    file_type: &str,
    storage_path: Option<&str>,
    file_url: Option<&str>,
    width: Option<i32>,
    height: Option<i32>,
    duration: Option<i32>,
) -> Result<MessengerFile, anyhow::Error> {
    let msg_uuid = Uuid::parse_str(message_id)
        .map_err(|e| anyhow::anyhow!("Invalid message_id: {}", e))?;
    
    let sender_uuid = Uuid::parse_str(sender_id)
        .map_err(|e| anyhow::anyhow!("Invalid sender_id: {}", e))?;
    
    let file = sqlx::query_as::<_, MessengerFile>(
        r#"
        INSERT INTO messenger_files (
            message_id, sender_user_id, file_name, file_size, mime_type, file_type,
            storage_path, file_url, width, height, duration
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
        "#
    )
    .bind(&msg_uuid)
    .bind(&sender_uuid)
    .bind(file_name)
    .bind(file_size)
    .bind(mime_type)
    .bind(file_type)
    .bind(&storage_path)
    .bind(&file_url)
    .bind(&width)
    .bind(&height)
    .bind(&duration)
    .fetch_one(pool)
    .await
    .map_err(|e| anyhow::anyhow!("Failed to upload file: {}", e))?;
    
    Ok(file)
}

/// Добавить реакцию на сообщение
pub async fn add_message_reaction(
    pool: &PgPool,
    message_id: &str,
    user_id: &str,
    emoji: &str,
) -> Result<MessageReaction, anyhow::Error> {
    let msg_uuid = Uuid::parse_str(message_id)
        .map_err(|e| anyhow::anyhow!("Invalid message_id: {}", e))?;
    
    let user_uuid = Uuid::parse_str(user_id)
        .map_err(|e| anyhow::anyhow!("Invalid user_id: {}", e))?;
    
    let reaction = sqlx::query_as::<_, MessageReaction>(
        r#"
        INSERT INTO message_reactions (message_id, user_id, emoji)
        VALUES ($1, $2, $3)
        ON CONFLICT (message_id, user_id, emoji) DO UPDATE SET emoji = EXCLUDED.emoji
        RETURNING *
        "#
    )
    .bind(&msg_uuid)
    .bind(&user_uuid)
    .bind(emoji)
    .fetch_one(pool)
    .await
    .map_err(|e| anyhow::anyhow!("Failed to add reaction: {}", e))?;
    
    Ok(reaction)
}

/// Удалить реакцию с сообщения
pub async fn remove_message_reaction(
    pool: &PgPool,
    message_id: &str,
    user_id: &str,
    emoji: &str,
) -> Result<(), anyhow::Error> {
    let msg_uuid = Uuid::parse_str(message_id)
        .map_err(|e| anyhow::anyhow!("Invalid message_id: {}", e))?;
    
    let user_uuid = Uuid::parse_str(user_id)
        .map_err(|e| anyhow::anyhow!("Invalid user_id: {}", e))?;
    
    sqlx::query(
        "DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3"
    )
    .bind(&msg_uuid)
    .bind(&user_uuid)
    .bind(emoji)
    .execute(pool)
    .await?;
    
    Ok(())
}

/// Получить conversation_id по message_id (для broadcast реакций)
pub async fn get_message_conversation_id(
    pool: &PgPool,
    message_id: &str,
) -> Result<Option<Uuid>, sqlx::Error> {
    let msg_uuid = Uuid::parse_str(message_id)
        .map_err(|e| sqlx::Error::Protocol(format!("Invalid message_id: {}", e)))?;
    sqlx::query_scalar::<_, Uuid>("SELECT conversation_id FROM messages WHERE id = $1")
        .bind(msg_uuid)
        .fetch_optional(pool)
        .await
}

/// Получить все реакции для сообщений в конверсации
pub async fn get_reactions_for_conversation(
    pool: &PgPool,
    conversation_id: &str,
) -> Result<Vec<MessageReaction>, sqlx::Error> {
    let conv_uuid = Uuid::parse_str(conversation_id)
        .map_err(|e| sqlx::Error::Protocol(format!("Invalid conversation_id: {}", e)))?;
    sqlx::query_as::<_, MessageReaction>(
        "SELECT mr.* FROM message_reactions mr
         JOIN messages m ON m.id = mr.message_id
         WHERE m.conversation_id = $1
         ORDER BY mr.message_id, mr.created_at",
    )
    .bind(conv_uuid)
    .fetch_all(pool)
    .await
}

/// Получить реакции на сообщение
pub async fn get_message_reactions(
    pool: &PgPool,
    message_id: &str,
) -> Result<Vec<MessageReaction>, sqlx::Error> {
    let msg_uuid = Uuid::parse_str(message_id)
        .map_err(|e| sqlx::Error::Protocol(format!("Invalid message_id: {}", e)))?;
    
    sqlx::query_as::<_, MessageReaction>(
        "SELECT * FROM message_reactions WHERE message_id = $1 ORDER BY created_at"
    )
    .bind(&msg_uuid)
    .fetch_all(pool)
    .await
}

/// Установить кастомное имя для контакта
pub async fn set_custom_contact_name(
    pool: &PgPool,
    user_id: &str,
    contact_user_id: &str,
    custom_name: Option<&str>,
) -> Result<(), anyhow::Error> {
    let owner_uuid = Uuid::parse_str(user_id)
        .map_err(|e| anyhow::anyhow!("Invalid user_id: {}", e))?;
    
    let contact_uuid = Uuid::parse_str(contact_user_id)
        .map_err(|e| anyhow::anyhow!("Invalid contact_user_id: {}", e))?;
    
    let n = sqlx::query(
        r#"
        UPDATE messenger_contacts
        SET custom_name = $3
        WHERE owner_user_id = $1 AND contact_user_id = $2
        "#
    )
    .bind(&owner_uuid)
    .bind(&contact_uuid)
    .bind(&custom_name)
    .execute(pool)
    .await?
    .rows_affected();
    if n == 0 {
        return Err(anyhow::anyhow!(
            "Контакт не найден. Добавьте пользователя в контакты, чтобы задать имя."
        ));
    }
    Ok(())
}

/// Получить контакты с онлайн-статусом
pub async fn get_contacts_with_status(
    pool: &PgPool,
    user_id: &str,
) -> Result<Vec<ContactWithStatus>, sqlx::Error> {
    let user_uuid = Uuid::parse_str(user_id)
        .unwrap_or(Uuid::nil());

    sqlx::query_as::<_, ContactWithStatus>(
        r#"
        SELECT
            mc.id,
            mc.contact_user_id,
            mp.display_name as contact_display_name,
            mp.messenger_id as contact_messenger_id,
            mp.avatar_url as contact_avatar_url,
            mc.custom_name,
            COALESCE(uos.is_online, FALSE) as is_online,
            uos.last_seen,
            uos.last_activity,
            mc.created_at as added_at
        FROM messenger_contacts mc
        JOIN messenger_profiles mp ON mp.user_id = mc.contact_user_id
        LEFT JOIN user_online_status uos ON uos.user_id = mc.contact_user_id
        WHERE mc.owner_user_id = $1 AND mc.status = 'accepted'
        ORDER BY COALESCE(mc.custom_name, mp.display_name)
        "#
    )
    .bind(&user_uuid)
    .fetch_all(pool)
    .await
}
