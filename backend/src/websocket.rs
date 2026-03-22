use anyhow::{anyhow, Context};
use futures_util::{SinkExt, StreamExt};
use log::{error, info, warn};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::{mpsc, RwLock};
use tokio::time::{Duration, interval};
use tokio_tungstenite::{
    accept_async,
    tungstenite::Message,
};
use uuid::Uuid;

use crate::auth::{self, User};
use crate::messenger;

/// Запись подключения (id для удаления при закрытии)
type ConnEntry = (Uuid, mpsc::UnboundedSender<String>);

/// Глобальное хранилище активных WebSocket подключений (несколько соединений на пользователя)
pub type SharedConnections = Arc<RwLock<HashMap<String, Vec<ConnEntry>>>>;

/// Данные файла для отправки через WebSocket
#[derive(Serialize, Deserialize, Clone)]
pub struct SendMessageFile {
    pub file_name: String,
    pub file_size: i64,
    pub mime_type: String,
    pub file_type: String, // image, video, audio, document
    pub data_base64: String, // Base64 encoded содержимое файла
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(tag = "type")]
pub enum WsMessage {
    // Auth messages
    Register {
        username: String,
        email: String,
        password: String,
    },
    Login {
        email: String,
        password: String,
    },
    Authorize {
        token: String,
    },
    AuthSuccess {
        token: String,
        user: User,
    },
    AuthError {
        message: String,
    },

    // Messenger requests
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
    GetReactionsForConversation {
        conversation_id: String,
    },
    SendMessage {
        conversation_id: String,
        content: String,
        message_type: Option<String>,
        media_url: Option<String>,
        reply_to_id: Option<String>,
        // Для файлов (base64 encoded данные)
        file_data: Option<SendMessageFile>,
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
    AddReaction {
        message_id: String,
        emoji: String,
    },
    RemoveReaction {
        message_id: String,
        emoji: String,
    },
    DeleteMessage {
        message_id: String,
    },
    EditMessage {
        message_id: String,
        content: String,
    },

    // Profile & Contacts
    SetupProfile {
        messenger_id: String,
        display_name: String,
        about: Option<String>,
    },
    GetProfile,
    UpdateProfile {
        display_name: Option<String>,
        avatar_url: Option<String>,
        about: Option<String>,
    },
    // Обновление настроек профиля (новое)
    UpdateProfileSettings {
        display_name: Option<String>,
        avatar_url: Option<String>,
        about: Option<String>,
        custom_user_id: Option<String>,
    },
    SearchUsers {
        query: String,
    },
    SendFriendRequest {
        receiver_messenger_id: String,
    },
    GetFriendRequests,
    CancelFriendRequest {
        request_id: String,
    },
    RespondToFriendRequest {
        request_id: String,
        accept: bool,
    },
    GetContacts,
    // Контакты с онлайн-статусом (новое)
    GetContactsOnline,
    // Кастомное имя контакта (новое)
    SetCustomContactName {
        contact_user_id: String,
        custom_name: Option<String>,
    },
    // Онлайн статус (новое)
    GetOnlineStatus {
        user_ids: Vec<String>,
    },
    UpdateActivity, // Обновить активность (heartbeat)
    RemoveContact {
        contact_user_id: String,
    },
    BlockContact {
        contact_user_id: String,
    },

    // Messenger responses
    ConversationCreated {
        conversation: messenger::ConversationWithLastMessage,
    },
    ConversationsList {
        conversations: Vec<messenger::ConversationWithLastMessage>,
    },
    ConversationUpdate {
        conversation: messenger::ConversationWithLastMessage,
    },
    MessagesList {
        messages: Vec<messenger::Message>,
        has_more: bool,
    },
    ReactionsForConversation {
        conversation_id: String,
        reactions: Vec<messenger::MessageReaction>,
    },
    MessageSent {
        message: messenger::Message,
    },
    MessageReceived {
        message: messenger::Message,
    },
    MessageDeleted {
        message_id: String,
        conversation_id: String,
    },
    MessageUpdated {
        message: messenger::Message,
    },
    MessageRead {
        message_id: String,
        user_id: String,
        read_at: String,
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
    // Profile & Contacts responses
    Profile {
        profile: messenger::MessengerProfile,
    },
    ProfilesList {
        profiles: Vec<messenger::MessengerProfile>,
    },
    ContactsList {
        contacts: Vec<messenger::Contact>,
    },
    // Контакты с онлайн-статусом (новое)
    ContactsOnlineList {
        contacts: Vec<messenger::ContactWithStatus>,
    },
    FriendRequestsList {
        requests: Vec<messenger::FriendRequest>,
        #[serde(default)]
        outgoing: Vec<messenger::OutgoingFriendRequest>,
    },
    FriendRequestSent {
        request: messenger::FriendRequest,
    },
    FriendRequestResponded {
        request_id: String,
        accepted: bool,
    },
    FriendRequestCancelled {
        request_id: String,
    },
    // Онлайн статус (новое)
    OnlineStatus {
        statuses: Vec<messenger::UserOnlineStatus>,
    },
    // Файлы (новое)
    FileUploaded {
        file: messenger::MessengerFile,
    },
    // Реакции (новое)
    ReactionAdded {
        reaction: messenger::MessageReaction,
    },
    ReactionRemoved {
        message_id: String,
        emoji: String,
        user_id: String,
    },

    // Common responses
    Ping,
    Pong,
    Error {
        code: String,
        message: String,
    },
}

pub async fn run_ws_server(
    host: &str,
    port: u16,
    pool: PgPool,
    jwt_secret: String,
    connections: SharedConnections,
) -> anyhow::Result<()> {
    let addr: SocketAddr = format!("{host}:{port}")
        .parse()
        .with_context(|| "invalid WS_HOST/WS_PORT")?;

    let listener = TcpListener::bind(addr)
        .await
        .with_context(|| format!("failed to bind websocket server on {addr}"))?;

    info!("WebSocket server listening on ws://{addr}");

    // Запускаем фоновую задачу для мониторинга неактивных пользователей
    let monitor_pool = pool.clone();
    tokio::spawn(async move {
        run_online_status_monitor(monitor_pool).await;
    });

    loop {
        let (stream, peer) = listener.accept().await?;
        let pool = pool.clone();
        let jwt_secret = jwt_secret.clone();
        let connections = Arc::clone(&connections);
        tokio::spawn(async move {
            if let Err(e) = handle_connection(stream, peer, pool, jwt_secret, connections).await {
                error!("ws connection error: {e:#}");
            }
        });
    }
}

/// Фоновая задача для проверки неактивных пользователей
/// Ставит пользователей в оффлайн после 30 секунд неактивности
async fn run_online_status_monitor(pool: PgPool) {
    let mut interval = interval(Duration::from_secs(10)); // Проверяем каждые 10 секунд
    
    loop {
        interval.tick().await;
        
        // Находим пользователей, у которых last_activity > 30 секунд назад
        // и ставим их в оффлайн
        let result = sqlx::query(
            r#"
            UPDATE user_online_status
            SET is_online = FALSE, last_seen = NOW()
            WHERE is_online = TRUE
            AND last_activity < NOW() - INTERVAL '30 seconds'
            "#
        )
        .execute(&pool)
        .await;
        
        if let Ok(rows) = result {
            if rows.rows_affected() > 0 {
                info!("Set {} users offline due to inactivity", rows.rows_affected());
            }
        }
    }
}

async fn handle_connection(
    stream: TcpStream,
    peer: SocketAddr,
    pool: PgPool,
    jwt_secret: String,
    connections: SharedConnections,
) -> anyhow::Result<()> {
    let ws_stream = match accept_async(stream).await {
        Ok(ws) => ws,
        Err(e) => {
            // Игнорируем ошибки handshake - это обычно означает, что клиент отключился во время handshake
            if e.to_string().contains("Handshake not finished") || e.to_string().contains("handshake") {
                log::debug!("WebSocket handshake failed for {} (client disconnected early)", peer);
                return Ok(());
            }
            return Err(e).with_context(|| format!("websocket handshake failed for {peer}"));
        }
    };

    info!("ws connected: {peer}");

    let (write, mut read) = ws_stream.split();
    
    // Канал для исходящих сообщений
    let (tx, mut rx) = mpsc::unbounded_channel::<String>();

    // Задача для отправки сообщений клиенту
    let mut write_sink = write;
    let send_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if write_sink.send(Message::Text(msg.into())).await.is_err() {
                break;
            }
        }
        write_sink
    });

    // Отправляем приветственное сообщение
    tx.send(r#"{"type":"welcome","message":"connected"}"#.to_string()).ok();

    let conn_id = Uuid::new_v4();
    let mut current_user: Option<User> = None;

    while let Some(msg) = read.next().await {
        match msg {
            Ok(Message::Text(text)) => {
                let incoming = parse_message(&text);
                let outgoing = match incoming {
                    Ok(WsMessage::Ping) => WsMessage::Pong,
                    
                    // Auth handlers
                    Ok(WsMessage::Register {
                        username,
                        email,
                        password,
                    }) => match auth::register_user(&pool, &jwt_secret, &username, &email, &password).await {
                        Ok((token, user)) => {
                            current_user = Some(user.clone());
                            // Регистрируем подключение (добавляем к списку, не заменяем)
                            if let Some(ref u) = current_user {
                                let mut conns = connections.write().await;
                                conns.entry(u.id.clone()).or_default().push((conn_id, tx.clone()));
                                info!("User {} registered and connected", u.username);
                            }
                            WsMessage::AuthSuccess { token, user }
                        },
                        Err(e) => WsMessage::AuthError {
                            message: e.to_string(),
                        },
                    },
                    Ok(WsMessage::Login { email, password }) => {
                        match auth::login_user(&pool, &jwt_secret, &email, &password).await {
                            Ok((token, user)) => {
                                current_user = Some(user.clone());
                                // Регистрируем подключение (добавляем к списку, не заменяем)
                                if let Some(ref u) = current_user {
                                    let mut conns = connections.write().await;
                                    conns.entry(u.id.clone()).or_default().push((conn_id, tx.clone()));
                                    info!("User {} logged in and connected", u.username);
                                }
                                WsMessage::AuthSuccess { token, user }
                            },
                            Err(e) => WsMessage::AuthError {
                                message: e.to_string(),
                            },
                        }
                    }
                    Ok(WsMessage::Authorize { token }) => {
                        match auth::authorize_user(&pool, &jwt_secret, &token).await {
                            Ok(user) => {
                                current_user = Some(user.clone());
                                // Регистрируем подключение (добавляем к списку, не заменяем)
                                if let Some(ref u) = current_user {
                                    let mut conns = connections.write().await;
                                    conns.entry(u.id.clone()).or_default().push((conn_id, tx.clone()));
                                    info!("User {} authorized", u.username);
                                }
                                WsMessage::AuthSuccess {
                                    token: token.to_string(),
                                    user,
                                }
                            },
                            Err(e) => WsMessage::AuthError {
                                message: e.to_string(),
                            },
                        }
                    }
                    
                    // Messenger handlers (требуют авторизации)
                    Ok(WsMessage::CreateConversation { user_ids, name, is_group }) => {
                        match current_user {
                            Some(ref user) => {
                                match messenger::create_conversation(
                                    &pool,
                                    &user.id,
                                    user_ids,
                                    name,
                                    is_group,
                                ).await {
                                    Ok(conversation) => {
                                        let full_conversation = messenger::get_user_conversations(&pool, &user.id)
                                            .await
                                            .ok()
                                            .and_then(|items| items.into_iter().find(|c| c.id == conversation.id));

                                        match full_conversation {
                                            Some(conversation) => WsMessage::ConversationCreated { conversation },
                                            None => WsMessage::Error {
                                                code: "conversation_error".to_string(),
                                                message: "Conversation created but failed to load view model".to_string(),
                                            },
                                        }
                                    },
                                    Err(e) => WsMessage::Error {
                                        code: "conversation_error".to_string(),
                                        message: e.to_string(),
                                    },
                                }
                            },
                            None => WsMessage::Error {
                                code: "not_authorized".to_string(),
                                message: "Требуется авторизация".to_string(),
                            },
                        }
                    }
                    Ok(WsMessage::GetConversations) => {
                        match current_user {
                            Some(ref user) => {
                                match messenger::get_user_conversations(&pool, &user.id).await {
                                    Ok(conversations) => {
                                        WsMessage::ConversationsList { conversations }
                                    },
                                    Err(e) => WsMessage::Error {
                                        code: "fetch_error".to_string(),
                                        message: e.to_string(),
                                    },
                                }
                            },
                            None => WsMessage::Error {
                                code: "not_authorized".to_string(),
                                message: "Требуется авторизация".to_string(),
                            },
                        }
                    }
                    Ok(WsMessage::GetMessages { conversation_id, limit, before }) => {
                        match current_user {
                            Some(ref user) => {
                                let limit_val = limit.unwrap_or(50);
                                let before_ts = before
                                    .and_then(|s| chrono::DateTime::parse_from_rfc3339(&s).ok())
                                    .map(|dt| dt.with_timezone(&chrono::Utc));

                                log::debug!("GetMessages for user {} conversation {} limit {}", user.id, conversation_id, limit_val);

                                match messenger::fetch_conversation_messages(
                                    &pool,
                                    &conversation_id,
                                    &user.id,
                                    limit_val,
                                    before_ts,
                                ).await {
                                    Ok(messages) => {
                                        let has_more = messages.len() as i32 >= limit_val;
                                        WsMessage::MessagesList { messages, has_more }
                                    },
                                    Err(e) => {
                                        log::error!("Failed to load messages: {}", e);
                                        WsMessage::Error {
                                            code: "fetch_error".to_string(),
                                            message: e.to_string(),
                                        }
                                    },
                                }
                            },
                            None => WsMessage::Error {
                                code: "not_authorized".to_string(),
                                message: "Требуется авторизация".to_string(),
                            },
                        }
                    }
                    Ok(WsMessage::GetReactionsForConversation { conversation_id }) => {
                        match current_user {
                            Some(_) => {
                                match messenger::get_reactions_for_conversation(&pool, &conversation_id).await {
                                    Ok(reactions) => WsMessage::ReactionsForConversation {
                                        conversation_id: conversation_id.clone(),
                                        reactions,
                                    },
                                    Err(_) => WsMessage::ReactionsForConversation {
                                        conversation_id: conversation_id.clone(),
                                        reactions: vec![],
                                    },
                                }
                            }
                            None => WsMessage::Error {
                                code: "not_authorized".to_string(),
                                message: "Требуется авторизация".to_string(),
                            },
                        }
                    }
                    Ok(WsMessage::SendMessage {
                        conversation_id,
                        content,
                        message_type,
                        media_url,
                        reply_to_id,
                        file_data,
                    }) => {
                        match current_user {
                            Some(ref user) => {
                                // Сначала создаём сообщение
                                let final_message_type = message_type.or_else(|| {
                                    file_data.as_ref().map(|f| f.file_type.clone())
                                });
                                
                                match messenger::send_message_full(
                                    &pool,
                                    &user.id,
                                    &conversation_id,
                                    &content,
                                    final_message_type,
                                    media_url,
                                    reply_to_id,
                                ).await {
                                    Ok(message) => {
                                        // Если есть файл, сохраняем его и привязываем к сообщению
                                        if let Some(file) = file_data {
                                            let file_url = format!("data:{};base64,{}", file.mime_type, file.data_base64);
                                            let _ = messenger::upload_message_file(
                                                &pool,
                                                &message.id.to_string(),
                                                &user.id,
                                                &file.file_name,
                                                file.file_size,
                                                &file.mime_type,
                                                &file.file_type,
                                                None,
                                                Some(&file_url),
                                                None,
                                                None,
                                                None,
                                            ).await;
                                        }

                                        let msg_json = serde_json::to_string(&WsMessage::MessageReceived {
                                            message: message.clone()
                                        }).unwrap_or_default();

                                        // Получаем обновлённую конверсацию с правильным unread_count для получателей
                                        let updated_conversations = messenger::get_user_conversations(&pool, &user.id).await.unwrap_or_default();
                                        let conv_for_recipients = updated_conversations.iter().find(|c| c.id.to_string() == conversation_id).cloned();
                                        
                                        // Отправляем сообщение и обновление конверсации всем участникам КРОМЕ отправителя
                                        if let Some(conv) = conv_for_recipients {
                                            let update_json = serde_json::to_string(&WsMessage::ConversationUpdate {
                                                conversation: conv
                                            }).unwrap_or_default();
                                            
                                            // Отправляем оба сообщения (MessageReceived + ConversationUpdate)
                                            messenger::broadcast_to_conversation_with_extra(
                                                &connections,
                                                &conversation_id,
                                                &pool,
                                                &msg_json,
                                                &update_json,
                                                &user.id,
                                            ).await;
                                        } else {
                                            messenger::broadcast_to_conversation(
                                                &connections,
                                                &conversation_id,
                                                &pool,
                                                &msg_json,
                                                &user.id,
                                                false,
                                            ).await;
                                        }

                                        // Отправляем сообщение также отправителю (чтобы видел у себя в чате)
                                        let _ = tx.send(msg_json.clone());

                                        // Отправляем отправителю подтверждение + обновлённый список чатов
                                        let conversations = updated_conversations;
                                        let conversations_json = serde_json::to_string(&WsMessage::ConversationsList { conversations }).unwrap_or_default();
                                        let _ = tx.send(conversations_json);

                                        WsMessage::MessageSent { message }
                                    },
                                    Err(e) => WsMessage::Error {
                                        code: "send_error".to_string(),
                                        message: e.to_string(),
                                    },
                                }
                            },
                            None => WsMessage::Error {
                                code: "not_authorized".to_string(),
                                message: "Требуется авторизация".to_string(),
                            },
                        }
                    }
                    Ok(WsMessage::MarkAsRead { conversation_id, message_ids: _ }) => {
                        match current_user {
                            Some(ref user) => {
                                match messenger::mark_messages_read_internal(
                                    &pool,
                                    &conversation_id,
                                    &user.id,
                                ).await {
                                    Ok(()) => {
                                        WsMessage::MessageRead {
                                            message_id: conversation_id.clone(),
                                            user_id: user.id.clone(),
                                            read_at: chrono::Utc::now().to_rfc3339(),
                                        }
                                    },
                                    Err(e) => WsMessage::Error {
                                        code: "mark_read_error".to_string(),
                                        message: e.to_string(),
                                    },
                                }
                            },
                            None => WsMessage::Error {
                                code: "not_authorized".to_string(),
                                message: "Требуется авторизация".to_string(),
                            },
                        }
                    }
                    Ok(WsMessage::TypingStart { conversation_id }) => {
                        match current_user {
                            Some(ref user) => {
                                let typing_json = serde_json::to_string(&WsMessage::UserTyping {
                                    conversation_id: conversation_id.clone(),
                                    user_id: user.id.clone(),
                                    username: user.username.clone(),
                                }).unwrap_or_default();

                                messenger::broadcast_to_conversation(
                                    &connections,
                                    &conversation_id,
                                    &pool,
                                    &typing_json,
                                    &user.id,
                                    false,
                                ).await;

                                continue; // Не отправляем ответ отправителю
                            },
                            None => WsMessage::Error {
                                code: "not_authorized".to_string(),
                                message: "Требуется авторизация".to_string(),
                            },
                        }
                    }
                    Ok(WsMessage::TypingStop { conversation_id }) => {
                        match current_user {
                            Some(ref user) => {
                                let stop_typing_json = serde_json::to_string(&WsMessage::UserStoppedTyping {
                                    conversation_id: conversation_id.clone(),
                                    user_id: user.id.clone(),
                                }).unwrap_or_default();

                                messenger::broadcast_to_conversation(
                                    &connections,
                                    &conversation_id,
                                    &pool,
                                    &stop_typing_json,
                                    &user.id,
                                    false,
                                ).await;

                                continue; // Не отправляем ответ отправителю
                            },
                            None => WsMessage::Error {
                                code: "not_authorized".to_string(),
                                message: "Требуется авторизация".to_string(),
                            },
                        }
                    }
                    Ok(WsMessage::AddReaction { message_id, emoji }) => {
                        match current_user {
                            Some(ref user) => {
                                match messenger::add_message_reaction(&pool, &message_id, &user.id, &emoji).await {
                                    Ok(reaction) => {
                                        if let Ok(Some(conv_id)) =
                                            messenger::get_message_conversation_id(&pool, &message_id).await
                                        {
                                            let json = serde_json::to_string(&WsMessage::ReactionAdded {
                                                reaction: reaction.clone(),
                                            })
                                            .unwrap_or_default();
                                            messenger::broadcast_to_conversation(
                                                &connections,
                                                &conv_id.to_string(),
                                                &pool,
                                                &json,
                                                &user.id,
                                                false,
                                            )
                                            .await;
                                        }
                                        WsMessage::ReactionAdded { reaction }
                                    }
                                    Err(e) => WsMessage::Error {
                                        code: "reaction_error".to_string(),
                                        message: e.to_string(),
                                    },
                                }
                            }
                            None => WsMessage::Error {
                                code: "not_authorized".to_string(),
                                message: "Требуется авторизация".to_string(),
                            },
                        }
                    }
                    Ok(WsMessage::RemoveReaction { message_id, emoji }) => {
                        match current_user {
                            Some(ref user) => {
                                match messenger::remove_message_reaction(&pool, &message_id, &user.id, &emoji).await {
                                    Ok(()) => {
                                        if let Ok(Some(conv_id)) =
                                            messenger::get_message_conversation_id(&pool, &message_id).await
                                        {
                                            let json = serde_json::to_string(&WsMessage::ReactionRemoved {
                                                message_id: message_id.clone(),
                                                emoji: emoji.clone(),
                                                user_id: user.id.clone(),
                                            })
                                            .unwrap_or_default();
                                            messenger::broadcast_to_conversation(
                                                &connections,
                                                &conv_id.to_string(),
                                                &pool,
                                                &json,
                                                &user.id,
                                                false,
                                            )
                                            .await;
                                        }
                                        WsMessage::ReactionRemoved {
                                            message_id,
                                            emoji,
                                            user_id: user.id.clone(),
                                        }
                                    }
                                    Err(e) => WsMessage::Error {
                                        code: "reaction_error".to_string(),
                                        message: e.to_string(),
                                    },
                                }
                            }
                            None => WsMessage::Error {
                                code: "not_authorized".to_string(),
                                message: "Требуется авторизация".to_string(),
                            },
                        }
                    }
                    Ok(WsMessage::DeleteMessage { message_id }) => {
                        match current_user {
                            Some(ref user) => {
                                match messenger::soft_delete_message(&pool, &message_id, &user.id).await {
                                    Ok(Some(conv_id)) => {
                                        let conv_str = conv_id.to_string();
                                        let json = serde_json::to_string(&WsMessage::MessageDeleted {
                                            message_id: message_id.clone(),
                                            conversation_id: conv_str.clone(),
                                        })
                                        .unwrap_or_default();
                                        messenger::broadcast_to_conversation(
                                            &connections,
                                            &conv_str,
                                            &pool,
                                            &json,
                                            &user.id,
                                            false,
                                        )
                                        .await;
                                        WsMessage::MessageDeleted {
                                            message_id,
                                            conversation_id: conv_str,
                                        }
                                    }
                                    Ok(None) => WsMessage::Error {
                                        code: "delete_error".to_string(),
                                        message: "Сообщение не найдено или нет прав".to_string(),
                                    },
                                    Err(e) => WsMessage::Error {
                                        code: "delete_error".to_string(),
                                        message: e.to_string(),
                                    },
                                }
                            }
                            None => WsMessage::Error {
                                code: "not_authorized".to_string(),
                                message: "Требуется авторизация".to_string(),
                            },
                        }
                    }
                    Ok(WsMessage::EditMessage { message_id, content }) => {
                        match current_user {
                            Some(ref user) => {
                                match messenger::edit_message_content(
                                    &pool,
                                    &message_id,
                                    &user.id,
                                    &content,
                                    &user.id,
                                )
                                .await
                                {
                                    Ok(Some(message)) => {
                                        let conv_str = message.conversation_id.to_string();
                                        let json = serde_json::to_string(&WsMessage::MessageUpdated {
                                            message: message.clone(),
                                        })
                                        .unwrap_or_default();
                                        messenger::broadcast_to_conversation(
                                            &connections,
                                            &conv_str,
                                            &pool,
                                            &json,
                                            &user.id,
                                            false,
                                        )
                                        .await;
                                        WsMessage::MessageUpdated { message }
                                    }
                                    Ok(None) => WsMessage::Error {
                                        code: "edit_error".to_string(),
                                        message: "Не удалось сохранить изменения".to_string(),
                                    },
                                    Err(e) => WsMessage::Error {
                                        code: "edit_error".to_string(),
                                        message: e.to_string(),
                                    },
                                }
                            }
                            None => WsMessage::Error {
                                code: "not_authorized".to_string(),
                                message: "Требуется авторизация".to_string(),
                            },
                        }
                    }

                    // Profile & Contacts handlers
                    Ok(WsMessage::SetupProfile { messenger_id, display_name, about }) => {
                        match current_user {
                            Some(ref user) => {
                                match messenger::setup_messenger_profile(
                                    &pool,
                                    &user.id,
                                    &messenger_id,
                                    &display_name,
                                    about.as_deref(),
                                ).await {
                                    Ok(profile) => WsMessage::Profile { profile },
                                    Err(e) => WsMessage::Error {
                                        code: "setup_error".to_string(),
                                        message: e.to_string(),
                                    },
                                }
                            },
                            None => WsMessage::Error {
                                code: "not_authorized".to_string(),
                                message: "Требуется авторизация".to_string(),
                            },
                        }
                    }
                    Ok(WsMessage::GetProfile) => {
                        match current_user {
                            Some(ref user) => {
                                match messenger::get_messenger_profile(&pool, &user.id).await {
                                    Ok(Some(profile)) => WsMessage::Profile { profile },
                                    Ok(None) => WsMessage::Error {
                                        code: "not_found".to_string(),
                                        message: "Профиль не найден".to_string(),
                                    },
                                    Err(e) => WsMessage::Error {
                                        code: "fetch_error".to_string(),
                                        message: e.to_string(),
                                    },
                                }
                            },
                            None => WsMessage::Error {
                                code: "not_authorized".to_string(),
                                message: "Требуется авторизация".to_string(),
                            },
                        }
                    }
                    Ok(WsMessage::SearchUsers { query }) => {
                        match current_user {
                            Some(ref user) => {
                                log::info!("SearchUsers request from user {} with query: {}", user.id, query);
                                
                                // Поиск доступен всем авторизованным пользователям
                                // Профиль мессенджера не обязателен для поиска
                                match messenger::search_users(&pool, &query, &user.id).await {
                                    Ok(profiles) => {
                                        log::info!("Search found {} profiles", profiles.len());
                                        WsMessage::ProfilesList { profiles }
                                    },
                                    Err(e) => {
                                        warn!("Search error: {}", e);
                                        WsMessage::ProfilesList { profiles: vec![] }
                                    },
                                }
                            },
                            None => WsMessage::Error {
                                code: "not_authorized".to_string(),
                                message: "Требуется авторизация".to_string(),
                            },
                        }
                    }
                    Ok(WsMessage::SendFriendRequest { receiver_messenger_id }) => {
                        match current_user {
                            Some(ref user) => {
                                match messenger::send_friend_request(&pool, &user.id, &receiver_messenger_id).await {
                                    Ok(request) => WsMessage::FriendRequestSent { request },
                                    Err(e) => WsMessage::Error {
                                        code: "request_error".to_string(),
                                        message: e.to_string(),
                                    },
                                }
                            },
                            None => WsMessage::Error {
                                code: "not_authorized".to_string(),
                                message: "Требуется авторизация".to_string(),
                            },
                        }
                    }
                    Ok(WsMessage::GetFriendRequests) => {
                        match current_user {
                            Some(ref user) => {
                                match (
                                    messenger::get_incoming_friend_requests(&pool, &user.id).await,
                                    messenger::get_outgoing_friend_requests(&pool, &user.id).await,
                                ) {
                                    (Ok(requests), Ok(outgoing)) => {
                                        WsMessage::FriendRequestsList { requests, outgoing }
                                    }
                                    (Err(e), _) | (_, Err(e)) => WsMessage::Error {
                                        code: "fetch_error".to_string(),
                                        message: e.to_string(),
                                    },
                                }
                            },
                            None => WsMessage::Error {
                                code: "not_authorized".to_string(),
                                message: "Требуется авторизация".to_string(),
                            },
                        }
                    }
                    Ok(WsMessage::CancelFriendRequest { request_id }) => {
                        match current_user {
                            Some(ref user) => {
                                let req_uuid = Uuid::parse_str(&request_id)
                                    .map_err(|e| anyhow::anyhow!("Invalid request_id: {}", e));
                                match req_uuid {
                                    Ok(req_uuid) => {
                                        match messenger::cancel_friend_request(&pool, &user.id, &req_uuid)
                                            .await
                                        {
                                            Ok(()) => WsMessage::FriendRequestCancelled { request_id },
                                            Err(e) => WsMessage::Error {
                                                code: "cancel_error".to_string(),
                                                message: e.to_string(),
                                            },
                                        }
                                    }
                                    Err(e) => WsMessage::Error {
                                        code: "invalid_id".to_string(),
                                        message: e.to_string(),
                                    },
                                }
                            },
                            None => WsMessage::Error {
                                code: "not_authorized".to_string(),
                                message: "Требуется авторизация".to_string(),
                            },
                        }
                    }
                    Ok(WsMessage::RespondToFriendRequest { request_id, accept }) => {
                        match current_user {
                            Some(ref user) => {
                                // Парсим request_id из String в Uuid
                                let req_uuid = Uuid::parse_str(&request_id)
                                    .map_err(|e| anyhow::anyhow!("Invalid request_id: {}", e));
                                match req_uuid {
                                    Ok(req_uuid) => {
                                        match messenger::respond_to_friend_request(&pool, &user.id, &req_uuid, accept).await {
                                            Ok(()) => WsMessage::FriendRequestResponded { request_id, accepted: accept },
                                            Err(e) => WsMessage::Error {
                                                code: "respond_error".to_string(),
                                                message: e.to_string(),
                                            },
                                        }
                                    },
                                    Err(e) => WsMessage::Error {
                                        code: "invalid_id".to_string(),
                                        message: e.to_string(),
                                    },
                                }
                            },
                            None => WsMessage::Error {
                                code: "not_authorized".to_string(),
                                message: "Требуется авторизация".to_string(),
                            },
                        }
                    }
                    Ok(WsMessage::GetContacts) => {
                        match current_user {
                            Some(ref user) => {
                                match messenger::get_contacts(&pool, &user.id).await {
                                    Ok(contacts) => WsMessage::ContactsList { contacts },
                                    Err(e) => WsMessage::Error {
                                        code: "fetch_error".to_string(),
                                        message: e.to_string(),
                                    },
                                }
                            },
                            None => WsMessage::Error {
                                code: "not_authorized".to_string(),
                                message: "Требуется авторизация".to_string(),
                            },
                        }
                    }
                    Ok(WsMessage::UpdateProfile { display_name, avatar_url, about }) => {
                        match current_user {
                            Some(ref user) => {
                                match messenger::update_profile(
                                    &pool,
                                    &user.id,
                                    display_name.as_deref(),
                                    avatar_url.as_deref(),
                                    about.as_deref(),
                                ).await {
                                    Ok(profile) => WsMessage::Profile { profile },
                                    Err(e) => WsMessage::Error {
                                        code: "update_error".to_string(),
                                        message: e.to_string(),
                                    },
                                }
                            },
                            None => WsMessage::Error {
                                code: "not_authorized".to_string(),
                                message: "Требуется авторизация".to_string(),
                            },
                        }
                    }
                    
                    // Новые обработчики настроек профиля
                    Ok(WsMessage::UpdateProfileSettings { display_name, avatar_url, about, custom_user_id }) => {
                        match current_user {
                            Some(ref user) => {
                                match messenger::update_profile_settings(
                                    &pool,
                                    &user.id,
                                    display_name.as_deref(),
                                    avatar_url.as_deref(),
                                    about.as_deref(),
                                    custom_user_id.as_deref(),
                                ).await {
                                    Ok(profile) => WsMessage::Profile { profile },
                                    Err(e) => WsMessage::Error {
                                        code: "update_error".to_string(),
                                        message: e.to_string(),
                                    },
                                }
                            },
                            None => WsMessage::Error {
                                code: "not_authorized".to_string(),
                                message: "Требуется авторизация".to_string(),
                            },
                        }
                    }
                    
                    // Контакты с онлайн-статусом
                    Ok(WsMessage::GetContactsOnline) => {
                        match current_user {
                            Some(ref user) => {
                                match messenger::get_contacts_with_status(&pool, &user.id).await {
                                    Ok(contacts) => WsMessage::ContactsOnlineList { contacts },
                                    Err(e) => WsMessage::Error {
                                        code: "fetch_error".to_string(),
                                        message: e.to_string(),
                                    },
                                }
                            },
                            None => WsMessage::Error {
                                code: "not_authorized".to_string(),
                                message: "Требуется авторизация".to_string(),
                            },
                        }
                    }
                    
                    // Кастомное имя контакта
                    Ok(WsMessage::SetCustomContactName { contact_user_id, custom_name }) => {
                        match current_user {
                            Some(ref user) => {
                                match messenger::set_custom_contact_name(
                                    &pool,
                                    &user.id,
                                    &contact_user_id,
                                    custom_name.as_deref(),
                                ).await {
                                    Ok(()) => WsMessage::Pong, // Просто подтверждаем
                                    Err(e) => WsMessage::Error {
                                        code: "update_error".to_string(),
                                        message: e.to_string(),
                                    },
                                }
                            },
                            None => WsMessage::Error {
                                code: "not_authorized".to_string(),
                                message: "Требуется авторизация".to_string(),
                            },
                        }
                    }
                    
                    // Онлайн статус пользователей
                    Ok(WsMessage::GetOnlineStatus { user_ids }) => {
                        match current_user {
                            Some(ref _user) => {
                                match messenger::get_users_online_status(&pool, &user_ids).await {
                                    Ok(statuses) => WsMessage::OnlineStatus { statuses },
                                    Err(e) => WsMessage::Error {
                                        code: "fetch_error".to_string(),
                                        message: e.to_string(),
                                    },
                                }
                            },
                            None => WsMessage::Error {
                                code: "not_authorized".to_string(),
                                message: "Требуется авторизация".to_string(),
                            },
                        }
                    }
                    
                    // Обновление активности (heartbeat)
                    Ok(WsMessage::UpdateActivity) => {
                        match current_user {
                            Some(ref user) => {
                                let _ = messenger::update_user_activity(&pool, &user.id).await;
                                WsMessage::Pong
                            },
                            None => WsMessage::Error {
                                code: "not_authorized".to_string(),
                                message: "Требуется авторизация".to_string(),
                            },
                        }
                    }

                    // Fallback
                    Ok(_) => WsMessage::Error {
                        code: "unsupported_message".to_string(),
                        message: "This message type is not accepted as client input".to_string(),
                    },
                    Err(e) => WsMessage::Error {
                        code: "invalid_payload".to_string(),
                        message: e.to_string(),
                    },
                };

                // Сериализуем и отправляем ответ
                let response_json = match &outgoing {
                    WsMessage::AuthSuccess { .. } |
                    WsMessage::AuthError { .. } |
                    WsMessage::Error { .. } |
                    WsMessage::Ping |
                    WsMessage::Pong => serde_json::to_string(&outgoing).ok(),
                    // Messenger responses
                    _ => serde_json::to_string(&outgoing).ok(),
                };
                
                if let Some(json) = response_json {
                    tx.send(json).ok();
                }
            }
            Ok(Message::Binary(_bin)) => {
                let outgoing = WsMessage::Error {
                    code: "binary_not_supported".to_string(),
                    message: "Binary frames are not supported".to_string(),
                };
                let json = serde_json::to_string(&outgoing).ok();
                if let Some(msg) = json {
                    tx.send(msg).ok();
                }
            }
            Ok(Message::Ping(_payload)) => {
                // Для Ping нужно остановить send_task, отправить Pong и продолжить
                // Это упрощенная реализация - просто игнорируем Ping
                // tungstenite автоматически отвечает на Ping
            }
            Ok(Message::Pong(_)) => {}
            Ok(Message::Close(frame)) => {
                info!("ws closed: {peer:?} {frame:?}");
                // Удаляем только это подключение из списка пользователя
                if let Some(ref user) = current_user {
                    let mut conns = connections.write().await;
                    if let Some(entries) = conns.get_mut(&user.id) {
                        entries.retain(|(id, _)| *id != conn_id);
                        if entries.is_empty() {
                            conns.remove(&user.id);
                            info!("User {} disconnected (last)", user.username);
                            let _ = messenger::set_user_online(&pool, &user.id, false).await;
                        } else {
                            info!("User {} disconnected ({} connections left)", user.username, entries.len());
                        }
                    }
                }
                break;
            }
            Err(e) => {
                return Err(anyhow::anyhow!(e));
            }
            _ => {}
        }
    }

    // Очищаем ресурсы
    send_task.abort();
    
    Ok(())
}

fn parse_message(text: &str) -> anyhow::Result<WsMessage> {
    serde_json::from_str::<WsMessage>(text).map_err(|e| anyhow!("Invalid WS message: {e}"))
}
