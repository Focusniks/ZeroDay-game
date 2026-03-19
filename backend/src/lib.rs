pub mod auth;
pub mod db;
pub mod websocket;

use jsonwebtoken::{DecodingKey, EncodingKey};

pub fn jwt_encoding_key(secret: &str) -> EncodingKey {
    EncodingKey::from_secret(secret.as_bytes())
}

pub fn jwt_decoding_key(secret: &str) -> DecodingKey {
    DecodingKey::from_secret(secret.as_bytes())
}

