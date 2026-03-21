-- Migration: 014_cleanup_null_profiles.sql
-- Удаляет старые тестовые профили с NULL user_id

-- Сначала удалим friend_requests которые ссылаются на профили с NULL user_id
DELETE FROM friend_requests 
WHERE sender_user_id IS NULL 
   OR receiver_user_id IS NULL;

-- Удаляем профили с NULL user_id (это старые тестовые профили)
DELETE FROM messenger_profiles 
WHERE user_id IS NULL 
  AND messenger_id IN ('alice', 'bob', 'charlie', 'diana', 'edward');

