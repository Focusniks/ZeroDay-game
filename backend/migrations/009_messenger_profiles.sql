-- Мессенджер: Профили, контакты и друзья
-- Расширение для 008_messenger.sql

-- Таблица профилей мессенджера
CREATE TABLE IF NOT EXISTS messenger_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    
    -- Уникальное имя в мессенджере (Signal ID)
    messenger_id TEXT UNIQUE NOT NULL,
    
    -- Публичная информация
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    about TEXT, -- Статус "о себе"
    
    -- Настройки
    privacy_settings JSONB DEFAULT '{"show_online_status": true, "show_read_receipts": true}'::jsonb,
    
    -- Состояние аккаунта
    is_setup_complete BOOLEAN NOT NULL DEFAULT FALSE,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Таблица контактов/друзей
CREATE TABLE IF NOT EXISTS messenger_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Статус дружбы
    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'blocked')),
    
    -- Кто добавил контакт
    added_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Заметка к контакту (пользовательское имя)
    custom_name TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT unique_contact_pair UNIQUE (owner_user_id, contact_user_id)
);

-- Таблица запросов в друзья (для удобства)
CREATE TABLE IF NOT EXISTS friend_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'declined')),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    responded_at TIMESTAMPTZ,
    
    CONSTRAINT unique_friend_request UNIQUE (sender_user_id, receiver_user_id)
);

-- Индексы
CREATE INDEX idx_messenger_profiles_user_id ON messenger_profiles(user_id);
CREATE INDEX idx_messenger_profiles_messenger_id ON messenger_profiles(messenger_id);
CREATE INDEX idx_messenger_contacts_owner ON messenger_contacts(owner_user_id);
CREATE INDEX idx_messenger_contacts_contact ON messenger_contacts(contact_user_id);
CREATE INDEX idx_friend_requests_sender ON friend_requests(sender_user_id);
CREATE INDEX idx_friend_requests_receiver ON friend_requests(receiver_user_id);

-- Триггер для обновления updated_at в profiles
CREATE OR REPLACE FUNCTION update_messenger_profile_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_messenger_profile_updated_at
    BEFORE UPDATE ON messenger_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_messenger_profile_updated_at();

-- View для друзей (взаимные контакты)
CREATE OR REPLACE VIEW messenger_friends AS
SELECT 
    mc.owner_user_id,
    mc.contact_user_id,
    mp.display_name,
    mp.avatar_url,
    mp.messenger_id,
    COALESCE(mc.custom_name, mp.display_name) as display_name_for_owner,
    mc.created_at
FROM messenger_contacts mc
JOIN messenger_profiles mp ON mp.user_id = mc.contact_user_id
WHERE mc.status = 'accepted';
