pub mod auth;
pub mod browser;
pub mod db;
pub mod middleware;
pub mod sites;
pub mod websocket;
pub mod fs_online;
pub mod messenger;
pub mod admin;
pub mod admin_http;
pub mod subscription;
pub mod subscription_http;

use jsonwebtoken::{EncodingKey, DecodingKey};
use sqlx::PgPool;

pub fn jwt_encoding_key(secret: &str) -> EncodingKey {
    EncodingKey::from_secret(secret.as_bytes())
}

pub fn jwt_decoding_key(secret: &str) -> DecodingKey {
    DecodingKey::from_secret(secret.as_bytes())
}

/// Shared application state accessible from all modules
#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub jwt_secret: String,
    pub rate_limiter: crate::middleware::RateLimiter,
}
