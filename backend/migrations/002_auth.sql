CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DROP TABLE IF EXISTS users;

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    ip_address VARCHAR(15) NOT NULL,
    level INTEGER DEFAULT 1,
    xp INTEGER DEFAULT 0,
    reputation INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);

