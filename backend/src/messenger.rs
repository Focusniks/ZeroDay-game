use anyhow::{anyhow, Context};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use sqlx::{FromRow, PgPool};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

use crate::auth::User;

/// Менеджер активных WebSocket подключений пользователей
pub type ActiveConnections = Arc<RwLock<HashMap<String, tokio::sync::mpsc::UnboundedSender<String>>>>;

// ==================== Профиль ====================

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct MessengerProfile {
    pub id: Uuid,
    pub user_id: Uuid,
    pub messenger_id: String,
    pub display_name: String,
    pub avatar_url: Option<String>,
    pub about: Option<String>,
    pub privacy_settings: Option<JsonValue>,
    pub is_setup_complete: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Contact {
    pub id: Uuid,
    pub owner_user_id: Uuid,
    pub contact_user_id: Uuid,
    pub status: String,
    pub custom_name: Option<String>,
    pub created_at: DateTime<Utc>,
    // Из профиля контакта
    pub contact_display_name: Option<String>,
    pub contact_avatar_url: Option<String>,
    pub contact_messenger_id: Option<String>,
    pub contact_about: Option<String>,
    pub is_online: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct FriendRequest {
    pub id: Uuid,
    pub sender_user_id: Uuid,
    pub receiver_user_id: Uuid,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub responded_at: Option<DateTime<Utc>>,
    // Из профиля отправителя
    pub sender_display_name: Option<String>,
    pub sender_avatar_url: Option<String>,
    pub sender_messenger_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum MessengerMessage {
    // Запросы от клиента
    CreateConversation {
        user_ids: Vec<String>,
        name: Option<String>,
        is_group: bool,
    },
    GetConversations,
    GetMessages {
        conversation_id: String,
        limit: Option<i32>,
        before: Option<String>,
    },
    SendMessage {
        conversation_id: String,
        content: String,
        message_type: Option<String>,
        media_url: Option<String>,
        reply_to_id: Option<String>,
    },
    MarkAsRead {
        conversation_id: String,
        message_ids: Vec<String>,
    },
    TypingStart {
        conversation_id: String,
    },
    TypingStop {
        conversation_id: String,
    },
    
    // Ответы сервера
    ConversationCreated {
        conversation: Conversation,
    },
    ConversationsList {
        conversations: Vec<ConversationWithLastMessage>,
    },
    MessagesList {
        messages: Vec<Message>,
        has_more: bool,
    },
    MessageSent {
        message: Message,
    },
    MessageReceived {
        message: Message,
    },
    MessageRead {
        message_id: String,
        user_id: String,
        read_at: DateTime<Utc>,
    },
    UserTyping {
        conversation_id: String,
        user_id: String,
        username: String,
    },
    UserStoppedTyping {
        conversation_id: String,
        user_id: String,
    },
    Error {
        code: String,
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Conversation {
    pub id: String,
    pub name: Option<String>,
    pub avatar_url: Option<String>,
    pub created_by: Option<String>,
    pub is_group: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    // Дополнительные поля для клиента
    #[sqlx(skip)]
    pub other_user: Option<OtherUserInfo>,
    #[sqlx(skip)]
    pub last_message: Option<LastMessageInfo>,
    #[sqlx(skip)]
    pub unread_count: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OtherUserInfo {
    pub id: String,
    pub username: String,
    pub avatar_url: Option<String>,
    pub is_online: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LastMessageInfo {
    pub id: String,
    pub content: String,
    pub sender_id: String,
    pub sender_username: String,
    pub created_at: DateTime<Utc>,
    pub message_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Message {
    pub id: String,
    pub conversation_id: String,
    pub sender_id: String,
    pub sender_username: Option<String>,
    pub content: String,
    pub message_type: String,
    pub media_url: Option<String>,
    pub media_metadata: Option<serde_json::Value>,
    pub reply_to_id: Option<String>,
    pub edited: bool,
    pub deleted: bool,
    pub created_at: DateTime<Utc>,
    pub is_read: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ConversationWithLastMessage {
    pub id: String,
    pub name: Option<String>,
    pub avatar_url: Option<String>,
    pub created_by: Option<String>,
    pub is_group: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub last_message_id: Option<String>,
    pub last_message_content: Option<String>,
    pub last_message_sender_id: Option<String>,
    pub last_message_sender_username: Option<String>,
    pub last_message_created_at: Option<DateTime<Utc>>,
    pub last_message_type: Option<String>,
    pub unread_count: i64,
    pub other_user_id: Option<String>,
    pub other_user_username: Option<String>,
    pub other_user_avatar_url: Option<String>,
}

/// Создать новый чат (личный или групповой)
pub async fn create_conversation(
    pool: &PgPool,
    current_user: &User,
    user_ids: Vec<String>,
    name: Option<String>,
    is_group: bool,
) -> anyhow::Result<Conversation> {
    if user_ids.is_empty() {
        return Err(anyhow!("Необходимо указать хотя бы одного участника"));
    }

    // Для личных чатов проверяем, нет ли уже существующего
    if !is_group && user_ids.len() == 1 {
        if let Some(existing) = find_existing_direct_conversation(pool, &current_user.id, &user_ids[0]).await? {
            return Ok(existing);
        }
    }

    let mut tx = pool.begin().await?;
    
    let conversation_id = Uuid::new_v4();
    
    sqlx::query(
        r#"
        INSERT INTO conversations (id, name, created_by, is_group)
        VALUES ($1, $2, $3, $4)
        "#,
    )
    .bind(conversation_id)
    .bind(&name)
    .bind(&current_user.id)
    .bind(is_group)
    .execute(&mut *tx)
    .await?;

    // Добавляем создателя как участника
    sqlx::query(
        r#"
        INSERT INTO conversation_members (conversation_id, user_id, role)
        VALUES ($1, $2, 'admin')
        "#,
    )
    .bind(conversation_id)
    .bind(&current_user.id)
    .execute(&mut *tx)
    .await?;

    // Добавляем остальных участников
    for user_id in &user_ids {
        let uuid = Uuid::parse_str(user_id)
            .with_context(|| format!("Неверный формат user_id: {}", user_id))?;
        
        sqlx::query(
            r#"
            INSERT INTO conversation_members (conversation_id, user_id)
            VALUES ($1, $2)
            ON CONFLICT (conversation_id, user_id) DO NOTHING
            "#,
        )
        .bind(conversation_id)
        .bind(uuid)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    // Получаем полный объект чата
    get_conversation_by_id(pool, &conversation_id.to_string(), &current_user.id).await?
        .ok_or_else(|| anyhow!("Не удалось получить созданный чат"))
}

/// Найти существующий личный чат между двумя пользователями
async fn find_existing_direct_conversation(
    pool: &PgPool,
    user1_id: &str,
    user2_id: &str,
) -> anyhow::Result<Option<Conversation>> {
    let conv = sqlx::query_as::<_, Conversation>(
        r#"
        SELECT c.id, c.name, c.avatar_url, c.created_by, c.is_group, c.created_at, c.updated_at
        FROM conversations c
        JOIN conversation_members cm1 ON c.id = cm1.conversation_id
        JOIN conversation_members cm2 ON c.id = cm2.conversation_id
        WHERE c.is_group = false
          AND cm1.user_id = $1
          AND cm2.user_id = $2
        LIMIT 1
        "#,
    )
    .bind(user1_id)
    .bind(user2_id)
    .fetch_optional(pool)
    .await?;

    Ok(conv)
}

/// Получить чат по ID
pub async fn get_conversation_by_id(
    pool: &PgPool,
    conversation_id: &str,
    current_user_id: &str,
) -> anyhow::Result<Option<Conversation>> {
    let mut conv = sqlx::query_as::<_, Conversation>(
        r#"
        SELECT c.id, c.name, c.avatar_url, c.created_by, c.is_group, c.created_at, c.updated_at
        FROM conversations c
        JOIN conversation_members cm ON c.id = cm.conversation_id
        WHERE c.id = $1 AND cm.user_id = $2
        "#,
    )
    .bind(conversation_id)
    .bind(current_user_id)
    .fetch_optional(pool)
    .await?;

    if let Some(ref mut c) = conv {
        // Получаем информацию о другом пользователе (для личных чатов)
        if !c.is_group {
            c.other_user = get_other_user_in_conversation(pool, conversation_id, current_user_id).await?;
        }
        
        // Получаем последнее сообщение
        c.last_message = get_last_message_info(pool, conversation_id).await?;
        
        // Получаем количество непрочитанных
        c.unread_count = get_unread_count(pool, conversation_id, current_user_id).await?;
    }

    Ok(conv)
}

/// Получить информацию о другом пользователе в чате
async fn get_other_user_in_conversation(
    pool: &PgPool,
    conversation_id: &str,
    current_user_id: &str,
) -> anyhow::Result<Option<OtherUserInfo>> {
    let row: Option<(String, String)> = sqlx::query_as(
        r#"
        SELECT u.id, u.username
        FROM users u
        JOIN conversation_members cm ON u.id = cm.user_id
        WHERE cm.conversation_id = $1 AND u.id != $2
        LIMIT 1
        "#,
    )
    .bind(conversation_id)
    .bind(current_user_id)
    .fetch_optional(pool)
    .await?;

    Ok(row.map(|(id, username)| OtherUserInfo {
        id,
        username,
        avatar_url: None,
        is_online: false,
    }))
}

/// Получить информацию о последнем сообщении
async fn get_last_message_info(
    pool: &PgPool,
    conversation_id: &str,
) -> anyhow::Result<Option<LastMessageInfo>> {
    let row: Option<(String, String, String, String, DateTime<Utc>, String)> = sqlx::query_as(
        r#"
        SELECT m.id, m.content, m.sender_id, u.username, m.created_at, m.message_type
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.conversation_id = $1 AND m.deleted = false
        ORDER BY m.created_at DESC
        LIMIT 1
        "#,
    )
    .bind(conversation_id)
    .fetch_optional(pool)
    .await?;

    Ok(row.map(|(id, content, sender_id, sender_username, created_at, message_type)| LastMessageInfo {
        id,
        content,
        sender_id,
        sender_username,
        created_at,
        message_type,
    }))
}

/// Получить количество непрочитанных сообщений
async fn get_unread_count(
    pool: &PgPool,
    conversation_id: &str,
    user_id: &str,
) -> anyhow::Result<i32> {
    let count = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(*)::BIGINT
        FROM messages m
        JOIN conversation_members cm ON m.conversation_id = cm.conversation_id
        WHERE m.conversation_id = $1
          AND m.sender_id != $2
          AND (cm.last_read_message_at IS NULL OR m.created_at > cm.last_read_message_at)
          AND m.deleted = false
        "#,
    )
    .bind(conversation_id)
    .bind(user_id)
    .fetch_one(pool)
    .await?;

    Ok(count as i32)
}

/// Получить список чатов пользователя
pub async fn get_user_conversations(
    pool: &PgPool,
    user_id: &str,
) -> anyhow::Result<Vec<ConversationWithLastMessage>> {
    let conversations = sqlx::query_as::<_, ConversationWithLastMessage>(
        r#"
        SELECT 
            c.id,
            c.name,
            c.avatar_url,
            c.created_by,
            c.is_group,
            c.created_at,
            c.updated_at,
            lm.last_message_id,
            lm.last_message_content,
            lm.last_message_sender_id,
            lm.last_message_sender_username,
            lm.last_message_created_at,
            lm.last_message_type,
            COALESCE(urc.unread_count, 0) as unread_count,
            ou.id as other_user_id,
            ou.username as other_user_username,
            NULL as other_user_avatar_url
        FROM conversations c
        JOIN conversation_members cm ON c.id = cm.conversation_id AND cm.user_id = $1
        LEFT JOIN LATERAL (
            SELECT 
                m.id as last_message_id,
                m.content as last_message_content,
                m.sender_id as last_message_sender_id,
                u.username as last_message_sender_username,
                m.created_at as last_message_created_at,
                m.message_type as last_message_type
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.conversation_id = c.id AND m.deleted = false
            ORDER BY m.created_at DESC
            LIMIT 1
        ) lm ON true
        LEFT JOIN LATERAL (
            SELECT COUNT(*)::BIGINT as unread_count
            FROM messages m
            WHERE m.conversation_id = c.id
              AND m.sender_id != $1
              AND (cm.last_read_message_at IS NULL OR m.created_at > cm.last_read_message_at)
              AND m.deleted = false
        ) urc ON true
        LEFT JOIN LATERAL (
            SELECT u.id, u.username
            FROM users u
            JOIN conversation_members cm2 ON u.id = cm2.user_id
            WHERE cm2.conversation_id = c.id AND u.id != $1
            LIMIT 1
        ) ou ON true
        ORDER BY c.updated_at DESC
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    Ok(conversations)
}

/// Получить сообщения чата
pub async fn get_conversation_messages(
    pool: &PgPool,
    conversation_id: &str,
    user_id: &str,
    limit: i32,
    before: Option<DateTime<Utc>>,
) -> anyhow::Result<Vec<Message>> {
    let messages = if let Some(before_ts) = before {
        sqlx::query_as::<_, Message>(
            r#"
            SELECT 
                m.id,
                m.conversation_id,
                m.sender_id,
                u.username as sender_username,
                m.content,
                m.message_type,
                m.media_url,
                m.media_metadata,
                m.reply_to_id,
                m.edited,
                m.deleted,
                m.created_at,
                EXISTS(
                    SELECT 1 FROM message_read_receipts mrr 
                    WHERE mrr.message_id = m.id AND mrr.user_id = $3
                ) as is_read
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.conversation_id = $1 
              AND m.created_at < $2
              AND m.deleted = false
            ORDER BY m.created_at DESC
            LIMIT $4
            "#,
        )
        .bind(conversation_id)
        .bind(before_ts)
        .bind(user_id)
        .bind(limit)
        .fetch_all(pool)
        .await?
    } else {
        sqlx::query_as::<_, Message>(
            r#"
            SELECT 
                m.id,
                m.conversation_id,
                m.sender_id,
                u.username as sender_username,
                m.content,
                m.message_type,
                m.media_url,
                m.media_metadata,
                m.reply_to_id,
                m.edited,
                m.deleted,
                m.created_at,
                EXISTS(
                    SELECT 1 FROM message_read_receipts mrr 
                    WHERE mrr.message_id = m.id AND mrr.user_id = $3
                ) as is_read
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.conversation_id = $1 
              AND m.deleted = false
            ORDER BY m.created_at DESC
            LIMIT $2
            "#,
        )
        .bind(conversation_id)
        .bind(limit)
        .bind(user_id)
        .fetch_all(pool)
        .await?
    };

    Ok(messages)
}

/// Отправить сообщение
pub async fn send_message(
    pool: &PgPool,
    current_user: &User,
    conversation_id: &str,
    content: String,
    message_type: Option<String>,
    media_url: Option<String>,
    reply_to_id: Option<String>,
) -> anyhow::Result<Message> {
    if content.trim().is_empty() {
        return Err(anyhow!("Сообщение не может быть пустым"));
    }

    // Проверяем, что пользователь является участником чата
    let is_member = sqlx::query_scalar::<_, bool>(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM conversation_members 
            WHERE conversation_id = $1 AND user_id = $2
        )
        "#,
    )
    .bind(conversation_id)
    .bind(&current_user.id)
    .fetch_one(pool)
    .await?;

    if !is_member {
        return Err(anyhow!("Вы не являетесь участником этого чата"));
    }

    let message_id = Uuid::new_v4();
    let msg_type = message_type.unwrap_or_else(|| "text".to_string());

    let mut tx = pool.begin().await?;

    // Создаем сообщение
    sqlx::query(
        r#"
        INSERT INTO messages (id, conversation_id, sender_id, content, message_type, media_url, reply_to_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        "#,
    )
    .bind(message_id)
    .bind(conversation_id)
    .bind(&current_user.id)
    .bind(&content)
    .bind(&msg_type)
    .bind(&media_url)
    .bind(&reply_to_id)
    .execute(&mut *tx)
    .await?;

    // Обновляем updated_at у чата
    sqlx::query(
        r#"UPDATE conversations SET updated_at = NOW() WHERE id = $1"#,
    )
    .bind(conversation_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    // Получаем созданное сообщение
    get_message_by_id(pool, &message_id.to_string(), &current_user.id).await?
        .ok_or_else(|| anyhow!("Не удалось получить созданное сообщение"))
}

/// Получить сообщение по ID
async fn get_message_by_id(
    pool: &PgPool,
    message_id: &str,
    user_id: &str,
) -> anyhow::Result<Option<Message>> {
    let msg = sqlx::query_as::<_, Message>(
        r#"
        SELECT 
            m.id,
            m.conversation_id,
            m.sender_id,
            u.username as sender_username,
            m.content,
            m.message_type,
            m.media_url,
            m.media_metadata,
            m.reply_to_id,
            m.edited,
            m.deleted,
            m.created_at,
            EXISTS(
                SELECT 1 FROM message_read_receipts mrr 
                WHERE mrr.message_id = m.id AND mrr.user_id = $2
            ) as is_read
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.id = $1
        "#,
    )
    .bind(message_id)
    .bind(user_id)
    .fetch_optional(pool)
    .await?;

    Ok(msg)
}

/// Отметить сообщения как прочитанные
pub async fn mark_messages_as_read(
    pool: &PgPool,
    user_id: &str,
    conversation_id: &str,
    message_ids: &[String],
) -> anyhow::Result<()> {
    if message_ids.is_empty() {
        return Ok(());
    }

    let mut tx = pool.begin().await?;

    // Добавляем записи о прочтении
    for msg_id in message_ids {
        sqlx::query(
            r#"
            INSERT INTO message_read_receipts (message_id, user_id)
            VALUES ($1, $2)
            ON CONFLICT (message_id, user_id) DO NOTHING
            "#,
        )
        .bind(msg_id)
        .bind(user_id)
        .execute(&mut *tx)
        .await?;
    }

    // Обновляем last_read_message_at
    sqlx::query(
        r#"
        UPDATE conversation_members 
        SET last_read_message_at = NOW()
        WHERE conversation_id = $1 AND user_id = $2
        "#,
    )
    .bind(conversation_id)
    .bind(user_id)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(())
}

/// Отправить сообщение всем участникам чата через WebSocket
pub async fn broadcast_to_conversation(
    connections: &ActiveConnections,
    conversation_id: &str,
    pool: &PgPool,
    message: &str,
) {
    // Получаем всех участников чата
    let member_ids: Vec<String> = sqlx::query_scalar::<_, String>(
        r#"SELECT user_id FROM conversation_members WHERE conversation_id = $1"#,
    )
    .bind(conversation_id)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    // Отправляем сообщение каждому участнику
    let guard = connections.read().await;
    for user_id in &member_ids {
        if let Some(sender) = guard.get(user_id) {
            let _ = sender.send(message.to_string());
        }
    }
}

/// Отправить сообщение конкретному пользователю
pub fn send_to_user(
    connections: &ActiveConnections,
    user_id: &str,
    message: &str,
) {
    tokio::spawn({
        let connections = Arc::clone(connections);
        let user_id = user_id.to_string();
        let message = message.to_string();
        async move {
            let guard = connections.read().await;
            if let Some(sender) = guard.get(&user_id) {
                let _ = sender.send(message);
            }
        }
    });
}

/// Обновить статус онлайн пользователя
pub async fn update_user_online_status(
    connections: &ActiveConnections,
    user_id: &str,
    is_online: bool,
    pool: &PgPool,
) {
    // Получаем все чаты пользователя
    let conversation_ids: Vec<String> = sqlx::query_scalar::<_, String>(
        r#"SELECT conversation_id FROM conversation_members WHERE user_id = $1::uuid"#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    // Получаем имя пользователя
    let username: String = sqlx::query_scalar::<_, String>(
        r#"SELECT username FROM users WHERE id = $1"#,
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await
    .ok()
    .flatten()
    .unwrap_or_default();

    let status_msg = if is_online {
        MessengerMessage::UserTyping {
            conversation_id: String::new(), // Пустой для статуса онлайн
            user_id: user_id.to_string(),
            username: username.clone(),
        }
    } else {
        MessengerMessage::UserStoppedTyping {
            conversation_id: String::new(),
            user_id: user_id.to_string(),
        }
    };

    if let Ok(json) = serde_json::to_string(&status_msg) {
        // Отправляем всем участникам чатов
        for conv_id in &conversation_ids {
            broadcast_to_conversation(connections, conv_id, pool, &json).await;
        }
    }
}

// ==================== Профиль мессенджера ====================

/// Создать или обновить профиль мессенджера
pub async fn setup_messenger_profile(
    pool: &PgPool,
    user_id: &str,
    messenger_id: &str,
    display_name: &str,
    about: Option<&str>,
) -> anyhow::Result<MessengerProfile> {
    // Проверяем, не занят ли messenger_id
    let existing = sqlx::query_scalar::<_, bool>(
        r#"SELECT EXISTS(SELECT 1 FROM messenger_profiles WHERE messenger_id = $1)"#,
    )
    .bind(messenger_id)
    .fetch_one(pool)
    .await?;

    if existing {
        return Err(anyhow!("Это имя мессенджера уже занято"));
    }

    let profile = sqlx::query_as::<_, MessengerProfile>(
        r#"
        INSERT INTO messenger_profiles (user_id, messenger_id, display_name, about, is_setup_complete)
        VALUES ($1::uuid, $2, $3, $4, true)
        ON CONFLICT (user_id) DO UPDATE SET
            messenger_id = EXCLUDED.messenger_id,
            display_name = EXCLUDED.display_name,
            about = EXCLUDED.about,
            is_setup_complete = true,
            updated_at = NOW()
        RETURNING *
        "#,
    )
    .bind(user_id)
    .bind(messenger_id)
    .bind(display_name)
    .bind(about)
    .fetch_one(pool)
    .await?;

    Ok(profile)
}

/// Получить профиль мессенджера пользователя
pub async fn get_messenger_profile(
    pool: &PgPool,
    user_id: &str,
) -> anyhow::Result<Option<MessengerProfile>> {
    let profile = sqlx::query_as::<_, MessengerProfile>(
        r#"SELECT * FROM messenger_profiles WHERE user_id = $1::uuid"#,
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await?;

    Ok(profile)
}

/// Получить профиль по messenger_id
pub async fn get_profile_by_messenger_id(
    pool: &PgPool,
    messenger_id: &str,
) -> anyhow::Result<Option<MessengerProfile>> {
    let profile = sqlx::query_as::<_, MessengerProfile>(
        r#"SELECT * FROM messenger_profiles WHERE messenger_id = $1"#,
    )
    .bind(messenger_id)
    .fetch_optional(pool)
    .await?;

    Ok(profile)
}

/// Обновить профиль мессенджера
pub async fn update_messenger_profile(
    pool: &PgPool,
    user_id: &str,
    display_name: Option<&str>,
    avatar_url: Option<&str>,
    about: Option<&str>,
) -> anyhow::Result<MessengerProfile> {
    let mut query = String::from(
        r#"UPDATE messenger_profiles SET updated_at = NOW()"#,
    );

    if display_name.is_some() {
        query.push_str(", display_name = $2");
    }
    if avatar_url.is_some() {
        query.push_str(", avatar_url = $3");
    }
    if about.is_some() {
        query.push_str(", about = $4");
    }

    query.push_str(" WHERE user_id = $1::uuid RETURNING *");

    let mut db_query = sqlx::query_as::<_, MessengerProfile>(&query).bind(user_id);
    
    if let Some(name) = display_name {
        db_query = db_query.bind(name);
    }
    if let Some(avatar) = avatar_url {
        db_query = db_query.bind(avatar);
    }
    if let Some(about_text) = about {
        db_query = db_query.bind(about_text);
    }

    let profile = db_query.fetch_one(pool).await?;

    Ok(profile)
}

// ==================== Контакты и друзья ====================

/// Отправить запрос в друзья
pub async fn send_friend_request(
    pool: &PgPool,
    sender_user_id: &str,
    receiver_messenger_id: &str,
) -> anyhow::Result<FriendRequest> {
    // Находим пользователя по messenger_id
    let receiver = get_profile_by_messenger_id(pool, receiver_messenger_id).await?
        .ok_or_else(|| anyhow!("Пользователь с таким messenger_id не найден"))?;

    if receiver.user_id.to_string() == sender_user_id {
        return Err(anyhow!("Нельзя добавить себя в друзья"));
    }

    // Проверяем, нет ли уже запроса
    let existing = sqlx::query_scalar::<_, bool>(
        r#"SELECT EXISTS(
            SELECT 1 FROM friend_requests
            WHERE sender_user_id = $1::uuid AND receiver_user_id = $2::uuid AND status = 'pending'
        )"#,
    )
    .bind(sender_user_id)
    .bind(&receiver.user_id)
    .fetch_one(pool)
    .await?;

    if existing {
        return Err(anyhow!("Запрос в друзья уже отправлен"));
    }

    let request = sqlx::query_as::<_, FriendRequest>(
        r#"
        INSERT INTO friend_requests (sender_user_id, receiver_user_id, status)
        VALUES ($1::uuid, $2::uuid, 'pending')
        ON CONFLICT (sender_user_id, receiver_user_id) DO UPDATE SET
            status = 'pending',
            created_at = NOW(),
            responded_at = NULL
        RETURNING *
        "#,
    )
    .bind(sender_user_id)
    .bind(&receiver.user_id)
    .fetch_one(pool)
    .await?;

    Ok(request)
}

/// Получить входящие запросы в друзья
pub async fn get_incoming_friend_requests(
    pool: &PgPool,
    user_id: &str,
) -> anyhow::Result<Vec<FriendRequest>> {
    let requests = sqlx::query_as::<_, FriendRequest>(
        r#"
        SELECT 
            fr.id, fr.sender_user_id, fr.receiver_user_id, fr.status, 
            fr.created_at, fr.responded_at,
            mp.display_name as sender_display_name,
            mp.avatar_url as sender_avatar_url,
            mp.messenger_id as sender_messenger_id
        FROM friend_requests fr
        JOIN messenger_profiles mp ON mp.user_id = fr.sender_user_id
        WHERE fr.receiver_user_id = $1::uuid AND fr.status = 'pending'
        ORDER BY fr.created_at DESC
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    Ok(requests)
}

/// Ответить на запрос в друзья
pub async fn respond_to_friend_request(
    pool: &PgPool,
    user_id: &str,
    request_id: &str,
    accept: bool,
) -> anyhow::Result<()> {
    let status = if accept { "accepted" } else { "declined" };

    sqlx::query(
        r#"
        UPDATE friend_requests
        SET status = $1, responded_at = NOW()
        WHERE id = $2 AND receiver_user_id = $3::uuid
        "#,
    )
    .bind(status)
    .bind(request_id)
    .bind(user_id)
    .execute(pool)
    .await?;

    // Если приняли, добавляем в контакты
    if accept {
        let request = sqlx::query_as::<_, (String, String)>(
            r#"SELECT sender_user_id, receiver_user_id FROM friend_requests WHERE id = $1"#,
        )
        .bind(request_id)
        .fetch_optional(pool)
        .await?;

        if let Some((sender, receiver)) = request {
            // Добавляем контакт обоим пользователям
            sqlx::query(
                r#"
                INSERT INTO messenger_contacts (owner_user_id, contact_user_id, status, added_by)
                VALUES ($1, $2, 'accepted', $3)
                ON CONFLICT (owner_user_id, contact_user_id) DO UPDATE SET
                    status = 'accepted'
                "#,
            )
            .bind(&receiver)
            .bind(&sender)
            .bind(&receiver)
            .execute(pool)
            .await?;

            sqlx::query(
                r#"
                INSERT INTO messenger_contacts (owner_user_id, contact_user_id, status, added_by)
                VALUES ($1, $2, 'accepted', $3)
                ON CONFLICT (owner_user_id, contact_user_id) DO UPDATE SET
                    status = 'accepted'
                "#,
            )
            .bind(&sender)
            .bind(&receiver)
            .bind(&receiver)
            .execute(pool)
            .await?;
        }
    }

    Ok(())
}

/// Получить список контактов
pub async fn get_contacts(
    pool: &PgPool,
    user_id: &str,
) -> anyhow::Result<Vec<Contact>> {
    let contacts = sqlx::query_as::<_, Contact>(
        r#"
        SELECT 
            mc.id, mc.owner_user_id, mc.contact_user_id, mc.status, 
            mc.custom_name, mc.created_at,
            mp.display_name as contact_display_name,
            mp.avatar_url as contact_avatar_url,
            mp.messenger_id as contact_messenger_id,
            mp.about as contact_about,
            false as is_online
        FROM messenger_contacts mc
        JOIN messenger_profiles mp ON mp.user_id = mc.contact_user_id
        WHERE mc.owner_user_id = $1::uuid AND mc.status != 'blocked'
        ORDER BY mc.created_at DESC
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    Ok(contacts)
}

/// Удалить контакт
pub async fn remove_contact(
    pool: &PgPool,
    user_id: &str,
    contact_user_id: &str,
) -> anyhow::Result<()> {
    sqlx::query(
        r#"DELETE FROM messenger_contacts WHERE owner_user_id = $1::uuid AND contact_user_id = $2::uuid"#,
    )
    .bind(user_id)
    .bind(contact_user_id)
    .execute(pool)
    .await?;

    Ok(())
}

/// Заблокировать контакт
pub async fn block_contact(
    pool: &PgPool,
    user_id: &str,
    contact_user_id: &str,
) -> anyhow::Result<()> {
    sqlx::query(
        r#"
        UPDATE messenger_contacts
        SET status = 'blocked'
        WHERE owner_user_id = $1::uuid AND contact_user_id = $2::uuid
        "#,
    )
    .bind(user_id)
    .bind(contact_user_id)
    .execute(pool)
    .await?;

    Ok(())
}

/// Поиск пользователей по messenger_id или display_name
pub async fn search_users(
    pool: &PgPool,
    query: &str,
    current_user_id: &str,
) -> anyhow::Result<Vec<MessengerProfile>> {
    log::info!("Searching for users with query: {}", query);
    let search_pattern = format!("%{}%", query);

    let users = sqlx::query_as::<_, MessengerProfile>(
        r#"
        SELECT * FROM messenger_profiles
        WHERE (messenger_id ILIKE $1 OR display_name ILIKE $1)
          AND user_id != $2
        LIMIT 20
        "#,
    )
    .bind(&search_pattern)
    .bind(current_user_id)
    .fetch_all(pool)
    .await?;

    log::info!("Found {} users", users.len());
    Ok(users)
}
