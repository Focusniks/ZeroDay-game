-- Migration: 012_add_test_messenger_profiles.sql
-- Добавляет тестовые профили мессенджера для всех существующих пользователей

-- Создаём профили для всех пользователей у которых их ещё нет
INSERT INTO messenger_profiles (user_id, messenger_id, display_name, about, is_setup_complete)
SELECT 
    u.id,
    LOWER(u.username) as messenger_id,
    COALESCE(u.username, 'User') as display_name,
    'Привет! Я использую Zerogram' as about,
    true as is_setup_complete
FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM messenger_profiles mp WHERE mp.user_id = u.id
)
ON CONFLICT (user_id) DO NOTHING;

-- Добавляем несколько тестовых профилей для поиска
-- Сначала создаём тестовых пользователей, затем профили
DO $$
DECLARE
    alice_id UUID;
    bob_id UUID;
    charlie_id UUID;
    diana_id UUID;
    edward_id UUID;
BEGIN
    -- Создаём тестовых пользователей
    INSERT INTO users (id, username, email, password_hash, ip_address, level, xp, reputation)
    SELECT gen_random_uuid(), 'alice_user', 'alice@test.com', 
           '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYzS3MebAJu',
           '127.0.0.1', 1, 0, 0
    WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'alice_user')
    RETURNING id INTO alice_id;
    
    INSERT INTO users (id, username, email, password_hash, ip_address, level, xp, reputation)
    SELECT gen_random_uuid(), 'bob_user', 'bob@test.com',
           '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYzS3MebAJu',
           '127.0.0.1', 1, 0, 0
    WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'bob_user')
    RETURNING id INTO bob_id;
    
    INSERT INTO users (id, username, email, password_hash, ip_address, level, xp, reputation)
    SELECT gen_random_uuid(), 'charlie_user', 'charlie@test.com',
           '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYzS3MebAJu',
           '127.0.0.1', 1, 0, 0
    WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'charlie_user')
    RETURNING id INTO charlie_id;
    
    INSERT INTO users (id, username, email, password_hash, ip_address, level, xp, reputation)
    SELECT gen_random_uuid(), 'diana_user', 'diana@test.com',
           '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYzS3MebAJu',
           '127.0.0.1', 1, 0, 0
    WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'diana_user')
    RETURNING id INTO diana_id;
    
    INSERT INTO users (id, username, email, password_hash, ip_address, level, xp, reputation)
    SELECT gen_random_uuid(), 'edward_user', 'edward@test.com',
           '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYzS3MebAJu',
           '127.0.0.1', 1, 0, 0
    WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'edward_user')
    RETURNING id INTO edward_id;
    
    -- Создаём профили для тестовых пользователей
    INSERT INTO messenger_profiles (user_id, messenger_id, display_name, about, is_setup_complete)
    VALUES 
        ((SELECT id FROM users WHERE username = 'alice_user'), 'alice', 'Alice Johnson', 'Разработчик программного обеспечения', true),
        ((SELECT id FROM users WHERE username = 'bob_user'), 'bob', 'Bob Smith', 'Дизайнер и фронтенд разработчик', true),
        ((SELECT id FROM users WHERE username = 'charlie_user'), 'charlie', 'Charlie Brown', 'Люблю программировать на Rust', true),
        ((SELECT id FROM users WHERE username = 'diana_user'), 'diana', 'Diana Prince', 'Fullstack разработчик', true),
        ((SELECT id FROM users WHERE username = 'edward_user'), 'edward', 'Edward Norton', 'DevOps инженер', true)
    ON CONFLICT (messenger_id) DO NOTHING;
END $$;


