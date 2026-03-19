use anyhow::{anyhow, Context};
use futures_util::{SinkExt, StreamExt};
use log::{error, info};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::net::SocketAddr;
use tokio::net::{TcpListener, TcpStream};
use tokio_tungstenite::{
    accept_async,
    tungstenite::Message,
};

use crate::auth::{self, User};

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
                    }) => match auth::register_user(&pool, &jwt_secret, &username, &email, &password).await {
                        Ok((token, user)) => WsMessage::AuthSuccess { token, user },
                        Err(e) => WsMessage::AuthError {
                            message: e.to_string(),
                        },
                    },
                    Ok(WsMessage::Login { email, password }) => {
                        match auth::login_user(&pool, &jwt_secret, &email, &password).await {
                            Ok((token, user)) => WsMessage::AuthSuccess { token, user },
                            Err(e) => WsMessage::AuthError {
                                message: e.to_string(),
                            },
                        }
                    }
                    Ok(WsMessage::Authorize { token }) => {
                        match auth::authorize_user(&pool, &jwt_secret, &token).await {
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

