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
use tokio_tungstenite::{
    accept_async,
    tungstenite::Message,
};

use crate::auth::{self, User};
use crate::messenger;

/// Глобальное хранилище активных WebSocket подключений
pub type SharedConnections = Arc<RwLock<HashMap<String, mpsc::UnboundedSender<String>>>>;

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
    SearchUsers {
        query: String,
    },
    SendFriendRequest {
        receiver_messenger_id: String,
    },
    GetFriendRequests,
    RespondToFriendRequest {
        request_id: String,
        accept: bool,
    },
    GetContacts,
    RemoveContact {
        contact_user_id: String,
    },
    BlockContact {
        contact_user_id: String,
    },

    // Messenger responses
    ConversationCreated {
        conversation: messenger::Conversation,
    },
    ConversationsList {
        conversations: Vec<messenger::ConversationWithLastMessage>,
    },
    MessagesList {
        messages: Vec<messenger::Message>,
        has_more: bool,
    },
    MessageSent {
        message: messenger::Message,
    },
    MessageReceived {
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
    FriendRequestsList {
        requests: Vec<messenger::FriendRequest>,
    },
    FriendRequestSent {
        request: messenger::FriendRequest,
    },
    FriendRequestResponded {
        request_id: String,
        accepted: bool,
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

async fn handle_connection(
    stream: TcpStream,
    peer: SocketAddr,
    pool: PgPool,
    jwt_secret: String,
    connections: SharedConnections,
) -> anyhow::Result<()> {
    let ws_stream = accept_async(stream)
        .await
        .with_context(|| format!("websocket handshake failed for {peer}"))?;

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
                            // Регистрируем подключение
                            if let Some(ref u) = current_user {
                                let mut conns = connections.write().await;
                                conns.insert(u.id.clone(), tx.clone());
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
                                // Регистрируем подключение
                                if let Some(ref u) = current_user {
                                    let mut conns = connections.write().await;
                                    conns.insert(u.id.clone(), tx.clone());
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
                                // Регистрируем подключение
                                if let Some(ref u) = current_user {
                                    let mut conns = connections.write().await;
                                    conns.insert(u.id.clone(), tx.clone());
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
                                    user,
                                    user_ids,
                                    name,
                                    is_group,
                                ).await {
                                    Ok(conversation) => {
                                        WsMessage::ConversationCreated { conversation }
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
                                let before_ts = before.and_then(|s| chrono::DateTime::parse_from_rfc3339(&s).ok())
                                    .map(|dt| dt.with_timezone(&chrono::Utc));

                                match messenger::get_conversation_messages(
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
                    Ok(WsMessage::SendMessage {
                        conversation_id,
                        content,
                        message_type,
                        media_url,
                        reply_to_id
                    }) => {
                        match current_user {
                            Some(ref user) => {
                                match messenger::send_message(
                                    &pool,
                                    user,
                                    &conversation_id,
                                    content,
                                    message_type,
                                    media_url,
                                    reply_to_id,
                                ).await {
                                    Ok(message) => {
                                        // Отправляем сообщение всем участникам чата
                                        let msg_json = serde_json::to_string(&WsMessage::MessageReceived {
                                            message: message.clone()
                                        }).unwrap_or_default();

                                        messenger::broadcast_to_conversation(
                                            &connections,
                                            &conversation_id,
                                            &pool,
                                            &msg_json,
                                        ).await;

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
                    Ok(WsMessage::MarkAsRead { conversation_id, message_ids }) => {
                        match current_user {
                            Some(ref user) => {
                                match messenger::mark_messages_as_read(
                                    &pool,
                                    &user.id,
                                    &conversation_id,
                                    &message_ids,
                                ).await {
                                    Ok(()) => {
                                        // Уведомляем других участников о прочтении
                                        for msg_id in &message_ids {
                                            let receipt_json = serde_json::to_string(&WsMessage::MessageRead {
                                                message_id: msg_id.clone(),
                                                user_id: user.id.clone(),
                                                read_at: chrono::Utc::now().to_rfc3339(),
                                            }).unwrap_or_default();

                                            messenger::broadcast_to_conversation(
                                                &connections,
                                                &conversation_id,
                                                &pool,
                                                &receipt_json,
                                            ).await;
                                        }
                                        WsMessage::MessageRead {
                                            message_id: message_ids.first().cloned().unwrap_or_default(),
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
                                ).await;

                                continue; // Не отправляем ответ отправителю
                            },
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
                                // Проверяем, есть ли у пользователя профиль мессенджера
                                match messenger::get_messenger_profile(&pool, &user.id).await {
                                    Ok(Some(_)) => {
                                        // Профиль есть, выполняем поиск
                                        match messenger::search_users(&pool, &query, &user.id).await {
                                            Ok(profiles) => WsMessage::ProfilesList { profiles },
                                            Err(e) => {
                                                warn!("Search error: {}", e);
                                                WsMessage::ProfilesList { profiles: vec![] }
                                            },
                                        }
                                    },
                                    Ok(None) | Err(_) => {
                                        // Профиля нет, возвращаем пустой результат
                                        WsMessage::ProfilesList { profiles: vec![] }
                                    }
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
                                match messenger::get_incoming_friend_requests(&pool, &user.id).await {
                                    Ok(requests) => WsMessage::FriendRequestsList { requests },
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
                    Ok(WsMessage::RespondToFriendRequest { request_id, accept }) => {
                        match current_user {
                            Some(ref user) => {
                                match messenger::respond_to_friend_request(&pool, &user.id, &request_id, accept).await {
                                    Ok(()) => WsMessage::FriendRequestResponded { request_id, accepted: accept },
                                    Err(e) => WsMessage::Error {
                                        code: "respond_error".to_string(),
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
                                match messenger::update_messenger_profile(
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
                // Удаляем пользователя из подключений
                if let Some(ref user) = current_user {
                    let mut conns = connections.write().await;
                    conns.remove(&user.id);
                    info!("User {} disconnected", user.username);
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
