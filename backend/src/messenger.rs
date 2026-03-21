//! Мессенджер - модели и функции
//! Работает с таблицами: messenger_profiles, messenger_contacts, friend_requests,
//! conversations, conversation_members, messages, message_read_receipts

use serde::{Deserialize, Serialize};
use sqlx::{PgPool, FromRow};
use uuid::Uuid;
use chrono::{DateTime, Utc};

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
}

/// Информация о другом пользователе в чате
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct OtherUserInfo {
    pub id: Uuid,
    pub username: String,
    pub avatar_url: Option<String>,
    pub is_online: bool,
}

/// Последнее сообщение в чате
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct LastMessageInfo {
    pub id: Uuid,
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
        
        // Создаём чат между пользователями
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
        
        // Добавляем участников
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
pub async fn get_user_conversations(
    pool: &PgPool,
    user_id: &str,
) -> Result<Vec<ConversationWithLastMessage>, sqlx::Error> {
    // Конвертируем user_id в Uuid
    let user_uuid = Uuid::parse_str(user_id)
        .unwrap_or(Uuid::nil());

    // Получаем базовые данные конверсаций
    let conversations = sqlx::query_as::<_, Conversation>(
        r#"
        SELECT c.id, c.name, c.avatar_url, c.created_by, c.is_group, c.created_at, c.updated_at
        FROM conversations c
        JOIN conversation_members cm ON c.id = cm.conversation_id
        WHERE cm.user_id = $1
        ORDER BY c.updated_at DESC
        "#
    )
    .bind(&user_uuid)
    .fetch_all(pool)
    .await?;

    // Для каждой конверсации получаем последнее сообщение и unread count
    let mut result = Vec::new();
    for conv in conversations {
        let last_message = sqlx::query_as::<_, LastMessageInfo>(
            r#"
            SELECT m.id, m.content, m.sender_id, mp.messenger_id as sender_username, m.created_at
            FROM messages m
            LEFT JOIN messenger_profiles mp ON mp.user_id = m.sender_id
            WHERE m.conversation_id = $1 AND m.deleted = false
            ORDER BY m.created_at DESC
            LIMIT 1
            "#
        )
        .bind(&conv.id)
        .fetch_optional(pool)
        .await?;

        let unread_count = sqlx::query_scalar::<_, i64>(
            r#"
            SELECT COUNT(*) FROM messages m
            LEFT JOIN message_read_receipts mrr ON mrr.message_id = m.id AND mrr.user_id = $1
            WHERE m.conversation_id = $2 AND m.sender_id != $1 AND mrr.message_id IS NULL AND m.deleted = false
            "#
        )
        .bind(&user_uuid)
        .bind(&conv.id)
        .fetch_one(pool)
        .await?;

        result.push(ConversationWithLastMessage {
            id: conv.id,
            name: conv.name,
            avatar_url: conv.avatar_url,
            created_by: conv.created_by,
            is_group: conv.is_group,
            created_at: conv.created_at,
            updated_at: conv.updated_at,
            last_message,
            unread_count,
        });
    }

    Ok(result)
}

/// Получить сообщения конверсации
pub async fn fetch_conversation_messages(
    pool: &PgPool,
    conversation_id: &str,
    user_id: &str,
    limit: i32,
) -> Result<Vec<Message>, sqlx::Error> {
    // Конвертируем conversation_id в Uuid
    let conv_uuid = Uuid::parse_str(conversation_id)
        .map_err(|e| sqlx::Error::Protocol(format!("Invalid conversation_id: {}", e)))?;
    
    // Конвертируем user_id в Uuid
    let user_uuid = Uuid::parse_str(user_id)
        .unwrap_or(Uuid::nil());
    
    sqlx::query_as::<_, Message>(
        r#"
        SELECT
            m.id, m.conversation_id, m.sender_id, m.content, m.message_type,
            m.created_at, m.updated_at,
            mp.messenger_id as sender_username,
            EXISTS(
                SELECT 1 FROM message_read_receipts mrr
                WHERE mrr.message_id = m.id AND mrr.user_id = $2
            ) as is_read
        FROM messages m
        LEFT JOIN messenger_profiles mp ON mp.user_id = m.sender_id
        WHERE m.conversation_id = $3 AND m.deleted = false
        ORDER BY m.created_at DESC
        LIMIT $1
        "#
    )
    .bind(limit)
    .bind(&user_uuid)
    .bind(&conv_uuid)
    .fetch_all(pool)
    .await
}

/// Получить сообщения (wrapper)
pub async fn get_conversation_messages(
    pool: &PgPool,
    conversation_id: &str,
    user_id: &str,
    limit: i32,
    _before: Option<DateTime<Utc>>,
) -> Result<Vec<Message>, sqlx::Error> {
    fetch_conversation_messages(pool, conversation_id, user_id, limit).await
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
        RETURNING *
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

/// Транслировать сообщение всем участникам конверсации (кроме отправителя)
pub async fn broadcast_to_conversation(
    connections: &tokio::sync::RwLock<std::collections::HashMap<String, tokio::sync::mpsc::UnboundedSender<String>>>,
    conversation_id: &str,
    pool: &PgPool,
    message_json: &str,
    sender_id: &str,
) {
    // Конвертируем conversation_id в Uuid
    let conv_uuid = Uuid::parse_str(conversation_id).ok();
    if conv_uuid.is_none() {
        return;
    }

    // Получаем всех участников конверсации
    let member_ids: Vec<String> = sqlx::query_scalar(
        "SELECT user_id::text FROM conversation_members WHERE conversation_id = $1"
    )
    .bind(&conv_uuid)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    // Отправляем каждому участнику КРОМЕ отправителя
    let conns = connections.read().await;
    for member_id in member_ids {
        if member_id != sender_id {
            if let Some(tx) = conns.get(&member_id) {
                let _ = tx.send(message_json.to_string());
            }
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
