use anyhow::anyhow;
use bcrypt::{hash, verify, DEFAULT_COST};
use jsonwebtoken::{Algorithm, Header, Validation};
use serde::{Deserialize, Serialize};
use sqlx::{Error as SqlxError, PgPool};
use uuid::Uuid;

use crate::{jwt_decoding_key, jwt_encoding_key};

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
    login: &str,
    password: &str,
) -> anyhow::Result<(String, User)> {
    let identifier = login.trim();
    if identifier.is_empty() || password.is_empty() {
        return Err(anyhow!("Укажите логин и пароль."));
    }

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

pub async fn authorize_user(pool: &PgPool, jwt_secret: &str, token: &str) -> anyhow::Result<User> {
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

pub async fn change_password(
    pool: &PgPool,
    user_id: &str,
    current_password: &str,
    new_password: &str,
) -> anyhow::Result<()> {
    if current_password.is_empty() {
        return Err(anyhow!("Текущий пароль обязателен."));
    }
    if new_password.len() < 8 {
        return Err(anyhow!("Новый пароль должен быть не короче 8 символов."));
    }

    let user_id = Uuid::parse_str(user_id).map_err(|e| anyhow!("Invalid user id: {e}"))?;
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

    if !verify(current_password, &db_user.password_hash).unwrap_or(false) {
        return Err(anyhow!("Текущий пароль неверный."));
    }

    let new_hash = hash(new_password, DEFAULT_COST)?;
    sqlx::query("UPDATE users SET password_hash = $1 WHERE id = $2")
        .bind(new_hash)
        .bind(user_id)
        .execute(pool)
        .await?;

    Ok(())
}

pub fn decode_user_id_from_jwt(token: &str, secret: &str) -> anyhow::Result<String> {
    let claims = decode_jwt_claims(token, secret)?;
    Ok(claims.sub)
}

fn decode_jwt_claims(token: &str, secret: &str) -> anyhow::Result<Claims> {
    let validation = Validation::new(Algorithm::HS256);
    let token_data = jsonwebtoken::decode::<Claims>(token, &jwt_decoding_key(secret), &validation)
        .map_err(|e| anyhow!("JWT verification failed: {e}"))?;
    Ok(token_data.claims)
}

fn generate_jwt(user_id: Uuid, secret: &str) -> anyhow::Result<String> {
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

fn generate_ip() -> String {
    let a: u8 = rand::random_range(1..=254);
    let b: u8 = rand::random_range(1..=254);
    format!("192.168.{a}.{b}")
}

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
