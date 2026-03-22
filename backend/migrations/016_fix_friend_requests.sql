-- Migration: 016_fix_friend_requests.sql
-- Исправление: добавляем алиасы для полей sender в friend_requests

-- Проверяем и добавляем колонки если их нет (для совместимости)
-- NOTE: friend_requests уже имеет sender_user_id и receiver_user_id
-- Но в коде messenger.rs мы используем поля sender_display_name, sender_messenger_id, sender_avatar_url
-- которые получаем через JOIN с messenger_profiles

-- Убеждаемся, что VIEW для friend_requests корректный
DROP VIEW IF EXISTS friend_requests_with_details;

CREATE OR REPLACE VIEW friend_requests_with_details AS
SELECT
    fr.id,
    fr.sender_user_id,
    COALESCE(mp.display_name, 'Unknown') as sender_display_name,
    COALESCE(mp.messenger_id, 'unknown') as sender_messenger_id,
    mp.avatar_url as sender_avatar_url,
    fr.receiver_user_id,
    fr.status,
    fr.created_at,
    fr.responded_at
FROM friend_requests fr
LEFT JOIN messenger_profiles mp ON mp.user_id = fr.sender_user_id
ORDER BY fr.created_at DESC;

-- Также создаём view для исходящих запросов
DROP VIEW IF EXISTS outgoing_friend_requests_with_details;

CREATE OR REPLACE VIEW outgoing_friend_requests_with_details AS
SELECT
    fr.id,
    fr.receiver_user_id,
    COALESCE(mp.display_name, 'Unknown') as receiver_display_name,
    COALESCE(mp.messenger_id, 'unknown') as receiver_messenger_id,
    mp.avatar_url as receiver_avatar_url,
    fr.sender_user_id,
    fr.status,
    fr.created_at,
    fr.responded_at
FROM friend_requests fr
LEFT JOIN messenger_profiles mp ON mp.user_id = fr.receiver_user_id
ORDER BY fr.created_at DESC;
