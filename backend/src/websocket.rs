use anyhow::{anyhow, Context};
use bcrypt::{hash, verify, DEFAULT_COST};
use futures_util::{SinkExt, StreamExt};
use jsonwebtoken::{Algorithm, Header, Validation};
use log::{error, info};
use rand::Rng;
use serde::{Deserialize, Serialize};
use sqlx::{Error as SqlxError, PgPool};
use std::net::SocketAddr;
use tokio::net::{TcpListener, TcpStream};
use tokio_tungstenite::{
    accept_async,
    tungstenite::Message,
};
use uuid::Uuid;

use crate::{jwt_decoding_key, jwt_encoding_key};

#[derive(Serialize, Deserialize, Clone)]
#[serde(tag = "type")]
pub enum WsMessage {
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
    Ping,
    Pong,
    Error {
        code: String,
        message: String,
    },
}

#[derive(Serialize, Deserialize, Clone)]
pub struct User {
    pub id: String,
    pub username: String,
    pub email: String,
    pub ip_address: String,
    pub level: i32,
    pub xp: i32,
    pub reputation: i32,
    pub disk_capacity_mb: i32,
}

#[derive(Deserialize, sqlx::FromRow)]
struct DbUser {
    id: Uuid,
    username: String,
    email: String,
    password_hash: String,
    ip_address: String,
    level: i32,
    xp: i32,
    reputation: i32,
    disk_capacity_mb: i32,
}

#[derive(Serialize, Deserialize, Clone)]
struct Claims {
    sub: String,
    exp: usize,
}

pub async fn run_ws_server(host: &str, port: u16, pool: PgPool, jwt_secret: String) -> anyhow::Result<()> {
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
        tokio::spawn(async move {
            if let Err(e) = handle_connection(stream, peer, pool, jwt_secret).await {
                error!("ws connection error: {e:#}");
            }
        });
    }
}

async fn handle_connection(stream: TcpStream, peer: SocketAddr, pool: PgPool, jwt_secret: String) -> anyhow::Result<()> {
    let ws_stream = accept_async(stream)
        .await
        .with_context(|| format!("websocket handshake failed for {peer}"))?;

    info!("ws connected: {peer}");

    let (mut write, mut read) = ws_stream.split();

    write
        .send(Message::Text(r#"{"type":"welcome","message":"connected"}"#.into()))
        .await
        .ok();

    while let Some(msg) = read.next().await {
        match msg {
            Ok(Message::Text(text)) => {
                let incoming = parse_message(&text);
                let outgoing = match incoming {
                    Ok(WsMessage::Ping) => WsMessage::Pong,
                    Ok(WsMessage::Register {
                        username,
                        email,
                        password,
                    }) => match register_user(&pool, &jwt_secret, &username, &email, &password).await {
                        Ok((token, user)) => WsMessage::AuthSuccess { token, user },
                        Err(e) => WsMessage::AuthError {
                            message: e.to_string(),
                        },
                    },
                    Ok(WsMessage::Login { email, password }) => {
                        match login_user(&pool, &jwt_secret, &email, &password).await {
                            Ok((token, user)) => WsMessage::AuthSuccess { token, user },
                            Err(e) => WsMessage::AuthError {
                                message: e.to_string(),
                            },
                        }
                    }
                    Ok(WsMessage::Authorize { token }) => {
                        match authorize_user(&pool, &jwt_secret, &token).await {
                            Ok(user) => WsMessage::AuthSuccess {
                                token: token.to_string(),
                                user,
                            },
                            Err(e) => WsMessage::AuthError {
                                message: e.to_string(),
                            },
                        }
                    }
                    Ok(_) => WsMessage::Error {
                        code: "unsupported_message".to_string(),
                        message: "This message type is not accepted as client input".to_string(),
                    },
                    Err(e) => WsMessage::Error {
                        code: "invalid_payload".to_string(),
                        message: e.to_string(),
                    },
                };

                send_ws_message(&mut write, &outgoing).await.ok();
            }
            Ok(Message::Binary(_bin)) => {
                let outgoing = WsMessage::Error {
                    code: "binary_not_supported".to_string(),
                    message: "Binary frames are not supported".to_string(),
                };
                send_ws_message(&mut write, &outgoing).await.ok();
            }
            Ok(Message::Ping(payload)) => {
                write.send(Message::Pong(payload)).await.ok();
            }
            Ok(Message::Pong(_)) => {}
            Ok(Message::Close(frame)) => {
                info!("ws closed: {peer:?} {frame:?}");
                break;
            }
            Err(e) => {
                return Err(anyhow::anyhow!(e));
            }
            _ => {}
        }
    }

    Ok(())
}

fn parse_message(text: &str) -> anyhow::Result<WsMessage> {
    serde_json::from_str::<WsMessage>(text).map_err(|e| anyhow!("Invalid WS message: {e}"))
}

async fn send_ws_message<S>(sink: &mut S, msg: &WsMessage) -> anyhow::Result<()>
where
    S: futures_util::Sink<Message, Error = tokio_tungstenite::tungstenite::Error> + Unpin,
{
    let raw = serde_json::to_string(msg)?;
    sink.send(Message::Text(raw.into()))
        .await
        .map_err(|e| anyhow!("failed to send ws message: {e:?}"))?;
    Ok(())
}

pub async fn register_user(
    pool: &PgPool,
    jwt_secret: &str,
    username: &str,
    email: &str,
    password: &str,
) -> anyhow::Result<(String, User)> {
    validate_register_input(username, email, password)?;

    let username = username.trim().to_lowercase();
    let email = email.trim().to_lowercase();
    let password_hash = hash(password, DEFAULT_COST)?;
    let ip_address = generate_ip();

    let db_user = sqlx::query_as::<_, DbUser>(
        r#"
        INSERT INTO users (username, email, password_hash, ip_address)
        VALUES ($1, $2, $3, $4)
        RETURNING id, username, email, password_hash, ip_address, level, xp, reputation, disk_capacity_mb
        "#,
    )
    .bind(username)
    .bind(email)
    .bind(password_hash)
    .bind(ip_address)
    .fetch_one(pool)
    .await
    .map_err(map_register_sqlx_error)?;

    let token = generate_jwt(db_user.id, jwt_secret)?;
    Ok((token, to_public_user(db_user)))
}

pub async fn login_user(
    pool: &PgPool,
    jwt_secret: &str,
    email: &str,
    password: &str,
) -> anyhow::Result<(String, User)> {
    let identifier = email.trim();
    if identifier.is_empty() || password.is_empty() {
        return Err(anyhow!("Укажите логин и пароль."));
    }

    // В клиенте поле называется `email`, но мы поддерживаем вход:
    // - по email (если в строке есть '@')
    // - по username (если '@' нет)
    let is_email = identifier.contains('@');
    let normalized = identifier.to_lowercase();

    let db_user = if is_email {
        sqlx::query_as::<_, DbUser>(
            r#"
            SELECT id, username, email, password_hash, ip_address, level, xp, reputation, disk_capacity_mb
            FROM users
            WHERE email = $1
            "#,
        )
        .bind(normalized)
        .fetch_optional(pool)
        .await?
    } else {
        sqlx::query_as::<_, DbUser>(
            r#"
            SELECT id, username, email, password_hash, ip_address, level, xp, reputation, disk_capacity_mb
            FROM users
            WHERE username = $1
            "#,
        )
        .bind(normalized)
        .fetch_optional(pool)
        .await?
    }
    .ok_or_else(|| anyhow!("Неверный логин или пароль."))?;

    if !verify(password, &db_user.password_hash).unwrap_or(false) {
        return Err(anyhow!("Неверный логин или пароль."));
    }

    sqlx::query("UPDATE users SET last_login = NOW() WHERE id = $1")
        .bind(db_user.id)
        .execute(pool)
        .await
        .ok();

    let token = generate_jwt(db_user.id, jwt_secret)?;
    Ok((token, to_public_user(db_user)))
}

async fn authorize_user(pool: &PgPool, jwt_secret: &str, token: &str) -> anyhow::Result<User> {
    let token = token.trim();
    if token.is_empty() {
        return Err(anyhow!("Empty token"));
    }

    let claims = decode_jwt_claims(token, jwt_secret)?;
    let user_id = Uuid::parse_str(&claims.sub).map_err(|e| anyhow!("Invalid token subject: {e}"))?;

    let db_user = sqlx::query_as::<_, DbUser>(
        r#"
        SELECT id, username, email, password_hash, ip_address, level, xp, reputation, disk_capacity_mb
        FROM users
        WHERE id = $1
        "#,
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| anyhow!("User not found"))?;

    Ok(to_public_user(db_user))
}

fn decode_jwt_claims(token: &str, secret: &str) -> anyhow::Result<Claims> {
    let validation = Validation::new(Algorithm::HS256);
    let token_data = jsonwebtoken::decode::<Claims>(token, &jwt_decoding_key(secret), &validation)
        .map_err(|e| anyhow!("JWT verification failed: {e}"))?;
    Ok(token_data.claims)
}

pub fn generate_jwt(user_id: Uuid, secret: &str) -> anyhow::Result<String> {
    let exp = (chrono::Utc::now() + chrono::Duration::hours(24)).timestamp() as usize;
    let claims = Claims {
        sub: user_id.to_string(),
        exp,
    };

    let token = jsonwebtoken::encode(
        &Header::new(Algorithm::HS256),
        &claims,
        &jwt_encoding_key(secret),
    )?;
    Ok(token)
}

pub fn verify_jwt(token: &str, secret: &str) -> bool {
    let validation = Validation::new(Algorithm::HS256);
    jsonwebtoken::decode::<Claims>(token, &jwt_decoding_key(secret), &validation).is_ok()
}

pub fn generate_ip() -> String {
    let mut rng = rand::rng();
    let a: u8 = rng.random_range(1..=254);
    let b: u8 = rng.random_range(1..=254);
    format!("192.168.{a}.{b}")
}

/// Превращает ошибку INSERT при регистрации в понятные сообщения для клиента (без текста PostgreSQL).
fn map_register_sqlx_error(e: SqlxError) -> anyhow::Error {
    if let Some(db) = e.as_database_error() {
        if db.code().as_deref() == Some("23505") {
            let c = db.constraint().unwrap_or("");
            if c.contains("email") {
                return anyhow!("Этот адрес электронной почты уже зарегистрирован в сети ZeroDay.");
            }
            if c.contains("username") {
                return anyhow!("Это имя пользователя уже занято в системе ZeroDay.");
            }
            return anyhow!("Учётная запись с такими данными уже существует в ZeroDay.");
        }
    }
    anyhow!("Не удалось завершить регистрацию. Попробуйте позже.")
}

fn validate_register_input(username: &str, email: &str, password: &str) -> anyhow::Result<()> {
    let username = username.trim();
    let email = email.trim();

    if !(3..=20).contains(&username.len()) {
        return Err(anyhow!("Имя пользователя: от 3 до 20 символов."));
    }
    if !username
        .chars()
        .all(|ch| ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == '_')
    {
        return Err(anyhow!("Имя пользователя: только латиница в нижнем регистре, цифры и символ «_»."));
    }
    if !email.contains('@') || !email.contains('.') {
        return Err(anyhow!("Некорректный формат email."));
    }
    if password.len() < 8 {
        return Err(anyhow!("Пароль должен быть не короче 8 символов."));
    }
    Ok(())
}

fn to_public_user(db_user: DbUser) -> User {
    User {
        id: db_user.id.to_string(),
        username: db_user.username,
        email: db_user.email,
        ip_address: db_user.ip_address,
        level: db_user.level,
        xp: db_user.xp,
        reputation: db_user.reputation,
        disk_capacity_mb: db_user.disk_capacity_mb,
    }
}

