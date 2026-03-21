-- Migration: 013_fix_test_profiles.sql
-- Исправляет тестовые профили - привязывает их к реальным пользователям

-- Создаём дополнительных тестовых пользователей
INSERT INTO users (id, username, email, password_hash, ip_address, level, xp, reputation)
SELECT 
    gen_random_uuid(),
    username,
    email,
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYzS3MebAJu',
    '127.0.0.1',
    1, 0, 0
FROM (
    VALUES 
        ('alice_user', 'alice@test.com'),
        ('bob_user', 'bob@test.com'),
        ('charlie_user', 'charlie@test.com'),
        ('diana_user', 'diana@test.com'),
        ('edward_user', 'edward@test.com')
) AS t(username, email)
WHERE NOT EXISTS (SELECT 1 FROM users WHERE users.username = t.username)
ON CONFLICT (username) DO NOTHING;

-- Обновляем существующие профили с NULL user_id
UPDATE messenger_profiles mp
SET user_id = u.id
FROM users u
WHERE mp.messenger_id IN ('alice', 'bob', 'charlie', 'diana', 'edward')
  AND mp.user_id IS NULL
  AND u.username = mp.messenger_id || '_user';

-- Если обновились не все, создаём новые профили
INSERT INTO messenger_profiles (user_id, messenger_id, display_name, about, is_setup_complete)
SELECT 
    u.id,
    REPLACE(u.username, '_user', ''),
    CASE u.username
        WHEN 'alice_user' THEN 'Alice Johnson'
        WHEN 'bob_user' THEN 'Bob Smith'
        WHEN 'charlie_user' THEN 'Charlie Brown'
        WHEN 'diana_user' THEN 'Diana Prince'
        WHEN 'edward_user' THEN 'Edward Norton'
        ELSE u.username
    END,
    CASE u.username
        WHEN 'alice_user' THEN 'Разработчик программного обеспечения'
        WHEN 'bob_user' THEN 'Дизайнер и фронтенд разработчик'
        WHEN 'charlie_user' THEN 'Люблю программировать на Rust'
        WHEN 'diana_user' THEN 'Fullstack разработчик'
        WHEN 'edward_user' THEN 'DevOps инженер'
        ELSE 'Привет! Я использую Zerogram'
    END,
    true
FROM users u
WHERE u.username IN ('alice_user', 'bob_user', 'charlie_user', 'diana_user', 'edward_user')
  AND NOT EXISTS (
      SELECT 1 FROM messenger_profiles mp 
      WHERE mp.user_id = u.id OR mp.messenger_id = REPLACE(u.username, '_user', '')
  )
ON CONFLICT (messenger_id) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    display_name = EXCLUDED.display_name,
    about = EXCLUDED.about;
