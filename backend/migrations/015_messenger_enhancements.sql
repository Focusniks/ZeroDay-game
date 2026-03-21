-- Migration: 015_messenger_enhancements.sql
-- Улучшения мессенджера: онлайн-статус, настройки профиля, файлы, оптимизация

-- 1. Добавляем таблицу онлайн-статусов пользователей
-- Хранит последнее время активности и статус онлайн
CREATE TABLE IF NOT EXISTS user_online_status (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    is_online BOOLEAN NOT NULL DEFAULT FALSE,
    last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_activity TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_online_status_is_online ON user_online_status(is_online);
CREATE INDEX idx_user_online_status_last_seen ON user_online_status(last_seen DESC);

-- 2. Добавляем поля в messenger_profiles для настроек
ALTER TABLE messenger_profiles 
ADD COLUMN IF NOT EXISTS custom_user_id TEXT, -- Пользовательский ID (опционально)
ADD COLUMN IF NOT EXISTS theme_settings JSONB DEFAULT '{"theme": "dark", "message_style": "bubble"}'::jsonb,
ADD COLUMN IF NOT EXISTS notification_settings JSONB DEFAULT '{"sound": true, "desktop_notifications": true, "show_preview": true}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_messenger_profiles_custom_user_id ON messenger_profiles(custom_user_id) WHERE custom_user_id IS NOT NULL;

-- 3. Таблица для загрузки файлов (метаданные)
CREATE TABLE IF NOT EXISTS messenger_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    sender_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Информация о файле
    file_name TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK (file_type IN ('image', 'video', 'audio', 'document', 'other')),
    
    -- Хранение (путь к файлу или URL)
    storage_path TEXT, -- Для локальных файлов
    file_url TEXT, -- URL для доступа к файлу
    
    -- Метаданные
    width INTEGER, -- Для изображений/видео
    height INTEGER, -- Для изображений/видео
    duration INTEGER, -- Для аудио/видео (в секундах)
    
    -- Безопасность
    file_hash TEXT, -- Хэш файла для проверки целостности
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    downloaded_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_messenger_files_message_id ON messenger_files(message_id);
CREATE INDEX IF NOT EXISTS idx_messenger_files_sender_user_id ON messenger_files(sender_user_id);
CREATE INDEX IF NOT EXISTS idx_messenger_files_file_type ON messenger_files(file_type);

-- 4. Добавляем поддержку эмодзи-реакций на сообщения
CREATE TABLE IF NOT EXISTS message_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_user_id ON message_reactions(user_id);

-- 5. Добавляем кастомные имена контактов (уже есть custom_name в messenger_contacts)
-- Убедимся, что поле используется корректно

-- 6. Оптимизация: добавляем составные индексы для чатов
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created 
ON messages(conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversation_members_user_role 
ON conversation_members(user_id, role);

-- 7. View для отображения контактов с онлайн-статусом
CREATE OR REPLACE VIEW messenger_contacts_with_status AS
SELECT
    mc.id,
    mc.owner_user_id,
    mc.contact_user_id,
    mc.status,
    mc.custom_name,
    mc.added_by,
    mc.created_at,
    mp.display_name,
    mp.avatar_url,
    mp.messenger_id,
    COALESCE(mp.custom_user_id, mp.messenger_id) as user_id_display,
    COALESCE(mc.custom_name, mp.display_name) as display_name_for_owner,
    COALESCE(uos.is_online, FALSE) as is_online,
    uos.last_seen,
    uos.last_activity
FROM messenger_contacts mc
JOIN messenger_profiles mp ON mp.user_id = mc.contact_user_id
LEFT JOIN user_online_status uos ON uos.user_id = mc.contact_user_id
WHERE mc.status = 'accepted';

-- 8. View для сообщений с информацией о файлах
CREATE OR REPLACE VIEW messages_with_files AS
SELECT
    m.id,
    m.conversation_id,
    m.sender_id,
    m.content,
    m.message_type,
    m.media_url,
    m.media_metadata,
    m.reply_to_id,
    m.edited,
    m.deleted,
    m.created_at,
    m.updated_at,
    mf.file_name,
    mf.file_size,
    mf.mime_type,
    mf.file_type,
    mf.file_url,
    mf.width,
    mf.height,
    mf.duration
FROM messages m
LEFT JOIN messenger_files mf ON mf.message_id = m.id;

-- 9. Функция для обновления статуса онлайн
CREATE OR REPLACE FUNCTION update_user_online_status(
    p_user_id UUID,
    p_is_online BOOLEAN DEFAULT TRUE
) RETURNS VOID AS $$
BEGIN
    INSERT INTO user_online_status (user_id, is_online, last_seen, last_activity)
    VALUES (p_user_id, p_is_online, NOW(), NOW())
    ON CONFLICT (user_id) DO UPDATE SET
        is_online = p_is_online,
        last_activity = NOW(),
        last_seen = CASE WHEN p_is_online THEN user_online_status.last_seen ELSE NOW() END;
END;
$$ LANGUAGE plpgsql;

-- 10. Функция для получения онлайн-статусов пользователей
CREATE OR REPLACE FUNCTION get_users_online_status(
    p_user_ids UUID[]
) RETURNS TABLE (
    user_id UUID,
    is_online BOOLEAN,
    last_seen TIMESTAMPTZ,
    last_activity TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        uos.user_id,
        COALESCE(uos.is_online, FALSE) as is_online,
        COALESCE(uos.last_seen, NOW()) as last_seen,
        COALESCE(uos.last_activity, NOW()) as last_activity
    FROM user_online_status uos
    WHERE uos.user_id = ANY(p_user_ids);
END;
$$ LANGUAGE plpgsql;

-- 11. Триггер для автоматического обновления last_activity при действиях пользователя
CREATE OR REPLACE FUNCTION trigger_user_activity()
RETURNS TRIGGER AS $$
BEGIN
    -- Обновляем last_activity при любом действии пользователя
    UPDATE user_online_status 
    SET last_activity = NOW()
    WHERE user_id = NEW.sender_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Добавляем триггер на сообщения
DROP TRIGGER IF EXISTS trg_message_user_activity ON messages;
CREATE TRIGGER trg_message_user_activity
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION trigger_user_activity();

-- 12. Добавляем поле для отображения имени контакта в conversation_members
ALTER TABLE conversation_members
ADD COLUMN IF NOT EXISTS custom_contact_name TEXT; -- Имя контакта только для этого пользователя

COMMENT ON COLUMN conversation_members.custom_contact_name IS 'Пользовательское имя контакта, видимое только владельцу записи';
