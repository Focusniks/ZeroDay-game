-- Migration 019: Modular Subscription System
-- Позволяет пользователям выбирать отдельные модули подписки

-- Таблица доступных модулей подписки
CREATE TABLE IF NOT EXISTS subscription_modules (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    category VARCHAR(50) NOT NULL, -- 'cosmetics', 'storage', 'access', 'features'
    base_price_monthly INTEGER NOT NULL CHECK (base_price_monthly >= 0),
    base_price_yearly INTEGER NOT NULL CHECK (base_price_yearly >= 0),
    discount_percent INTEGER DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
    available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Индексы для модулей
CREATE INDEX IF NOT EXISTS idx_subscription_modules_category ON subscription_modules(category);
CREATE INDEX IF NOT EXISTS idx_subscription_modules_available ON subscription_modules(available);

-- Таблица пользовательских подписок (основная)
CREATE TABLE IF NOT EXISTS user_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active', 'cancelled', 'expired'
    total_monthly_price INTEGER NOT NULL DEFAULT 0,
    total_yearly_price INTEGER NOT NULL DEFAULT 0,
    billing_period VARCHAR(20) NOT NULL DEFAULT 'monthly', -- 'monthly', 'yearly'
    auto_renew BOOLEAN DEFAULT TRUE,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Частичный уникальный индекс для активной подписки (один активный на пользователя)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_subscriptions_unique_active ON user_subscriptions(user_id) WHERE status = 'active';

-- Индексы для подписок
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_expires_at ON user_subscriptions(expires_at);

-- Таблица выбранных модулей подписки
CREATE TABLE IF NOT EXISTS user_subscription_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES user_subscriptions(id) ON DELETE CASCADE,
    module_id VARCHAR(50) NOT NULL REFERENCES subscription_modules(id) ON DELETE CASCADE,
    monthly_price INTEGER NOT NULL,
    yearly_price INTEGER NOT NULL,
    activated_at TIMESTAMPTZ DEFAULT NOW(),
    deactivated_at TIMESTAMPTZ
);

-- Частичный уникальный индекс для активных модулей (один активный модуль на подписку)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_subscription_modules_unique_active ON user_subscription_modules(subscription_id, module_id) WHERE deactivated_at IS NULL;

-- Индексы для модулей подписки
CREATE INDEX IF NOT EXISTS idx_user_subscription_modules_subscription_id ON user_subscription_modules(subscription_id);
CREATE INDEX IF NOT EXISTS idx_user_subscription_modules_module_id ON user_subscription_modules(module_id);

-- Таблица истории изменений подписки
CREATE TABLE IF NOT EXISTS user_subscription_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES user_subscriptions(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL, -- 'created', 'module_added', 'module_removed', 'renewed', 'cancelled', 'reactivated'
    module_id VARCHAR(50) REFERENCES subscription_modules(id) ON DELETE SET NULL,
    price_change INTEGER, -- Изменение цены (может быть отрицательным)
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Индексы для истории
CREATE INDEX IF NOT EXISTS idx_user_subscription_history_user_id ON user_subscription_history(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscription_history_subscription_id ON user_subscription_history(subscription_id);
CREATE INDEX IF NOT EXISTS idx_user_subscription_history_action ON user_subscription_history(action);

-- Таблица транзакций подписки
CREATE TABLE IF NOT EXISTS subscription_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES user_subscriptions(id) ON DELETE SET NULL,
    amount INTEGER NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'RUB',
    type VARCHAR(30) NOT NULL, -- 'charge', 'refund', 'proration'
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'failed'
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

-- Индексы для транзакций
CREATE INDEX IF NOT EXISTS idx_subscription_transactions_user_id ON subscription_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_transactions_subscription_id ON subscription_transactions(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_transactions_status ON subscription_transactions(status);

-- ==================== ПРЕДЕФИНИРОВАННЫЕ МОДУЛИ ====================

-- Косметические модули
INSERT INTO subscription_modules (id, name, description, icon, category, base_price_monthly, base_price_yearly, discount_percent) VALUES
    ('colored_nickname', 'Цветной никнейм', 'Возможность использовать цветной ник в чате и на форуме', 'Palette', 'cosmetics', 50, 500, 17),
    ('nickname_effects', 'Эффекты никнейма', 'Анимированные эффекты вокруг никнейма', 'Sparkles', 'cosmetics', 100, 1000, 17),
    ('profile_customization', 'Кастомизация профиля', 'Расширенные возможности настройки профиля', 'UserCog', 'cosmetics', 75, 750, 17),
    ('exclusive_skins', 'Эксклюзивные скины', 'Доступ к уникальным скинам интерфейса', 'Paintbrush', 'cosmetics', 150, 1500, 17);

-- Модули хранилища
INSERT INTO subscription_modules (id, name, description, icon, category, base_price_monthly, base_price_yearly, discount_percent) VALUES
    ('disk_1gb', 'Диск 1GB', 'Дополнительное облачное хранилище 1GB', 'HardDrive', 'storage', 30, 300, 17),
    ('disk_5gb', 'Диск 5GB', 'Дополнительное облачное хранилище 5GB', 'HardDrive', 'storage', 100, 1000, 17),
    ('disk_10gb', 'Диск 10GB', 'Дополнительное облачное хранилище 10GB', 'HardDrive', 'storage', 180, 1800, 17),
    ('unlimited_storage', 'Безлимитное хранилище', 'Неограниченное облачное хранилище', 'Infinity', 'storage', 300, 3000, 17);

-- Модули доступа
INSERT INTO subscription_modules (id, name, description, icon, category, base_price_monthly, base_price_yearly, discount_percent) VALUES
    ('vip_sites_access', 'Доступ к VIP сайтам', 'Доступ к закрытым премиум сайтам', 'Lock', 'access', 100, 1000, 17),
    ('early_access', 'Ранний доступ', 'Доступ к бета-функциям и тестам', 'FlaskConical', 'access', 150, 1500, 17),
    ('exclusive_forums', 'Эксклюзивные форумы', 'Доступ к закрытым разделам форума', 'MessageSquare', 'access', 80, 800, 17);

-- Модули функций
INSERT INTO subscription_modules (id, name, description, icon, category, base_price_monthly, base_price_yearly, discount_percent) VALUES
    ('priority_support', 'Приоритетная поддержка', 'Приоритетное обслуживание в поддержке', 'Headphones', 'features', 100, 1000, 17),
    ('analytics', 'Расширенная аналитика', 'Детальная статистика и аналитика аккаунта', 'BarChart3', 'features', 120, 1200, 17),
    ('api_access', 'API доступ', 'Доступ к расширенному API', 'Code2', 'features', 200, 2000, 17),
    ('auto_backup', 'Автобэкап', 'Автоматическое резервное копирование', 'DatabaseBackup', 'features', 60, 600, 17);

-- ==================== ФУНКЦИИ ====================

-- Функция для получения активной подписки пользователя
CREATE OR REPLACE FUNCTION get_user_active_subscription(p_user_id UUID)
RETURNS TABLE (
    subscription_id UUID,
    status VARCHAR,
    total_monthly_price INTEGER,
    total_yearly_price INTEGER,
    billing_period VARCHAR,
    expires_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        us.id,
        us.status,
        us.total_monthly_price,
        us.total_yearly_price,
        us.billing_period,
        us.expires_at
    FROM user_subscriptions us
    WHERE us.user_id = p_user_id 
    AND us.status = 'active'
    AND (us.expires_at IS NULL OR us.expires_at > NOW());
END;
$$ LANGUAGE plpgsql;

-- Функция для получения модулей активной подписки
CREATE OR REPLACE FUNCTION get_user_subscription_modules(p_subscription_id UUID)
RETURNS TABLE (
    module_id VARCHAR,
    name VARCHAR,
    description TEXT,
    icon VARCHAR,
    category VARCHAR,
    monthly_price INTEGER,
    yearly_price INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sm.id,
        sm.name,
        sm.description,
        sm.icon,
        sm.category,
        usm.monthly_price,
        usm.yearly_price
    FROM user_subscription_modules usm
    JOIN subscription_modules sm ON sm.id = usm.module_id
    WHERE usm.subscription_id = p_subscription_id
    AND usm.deactivated_at IS NULL
    AND sm.available = TRUE;
END;
$$ LANGUAGE plpgsql;

-- Функция для обновления цены подписки
CREATE OR REPLACE FUNCTION update_subscription_price(p_subscription_id UUID)
RETURNS VOID AS $$
DECLARE
    v_billing_period VARCHAR;
    v_total_monthly INTEGER := 0;
    v_total_yearly INTEGER := 0;
BEGIN
    -- Получаем billing период
    SELECT billing_period INTO v_billing_period
    FROM user_subscriptions WHERE id = p_subscription_id;
    
    -- Считаем сумму модулей
    SELECT 
        COALESCE(SUM(monthly_price), 0),
        COALESCE(SUM(yearly_price), 0)
    INTO v_total_monthly, v_total_yearly
    FROM user_subscription_modules
    WHERE subscription_id = p_subscription_id
    AND deactivated_at IS NULL;
    
    -- Обновляем подписку
    UPDATE user_subscriptions
    SET 
        total_monthly_price = v_total_monthly,
        total_yearly_price = v_total_yearly,
        updated_at = NOW()
    WHERE id = p_subscription_id;
END;
$$ LANGUAGE plpgsql;

-- Триггер для обновления цены при изменении модулей
CREATE OR REPLACE FUNCTION trigger_update_subscription_price()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_TABLE_NAME = 'user_subscription_modules' THEN
        PERFORM update_subscription_price(
            CASE 
                WHEN TG_OP = 'DELETE' THEN OLD.subscription_id 
                ELSE NEW.subscription_id 
            END
        );
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_subscription_price_after_insert
    AFTER INSERT ON user_subscription_modules
    FOR EACH ROW EXECUTE FUNCTION trigger_update_subscription_price();

CREATE TRIGGER trg_update_subscription_price_after_update
    AFTER UPDATE ON user_subscription_modules
    FOR EACH ROW EXECUTE FUNCTION trigger_update_subscription_price();

CREATE TRIGGER trg_update_subscription_price_after_delete
    AFTER DELETE ON user_subscription_modules
    FOR EACH ROW EXECUTE FUNCTION trigger_update_subscription_price();

-- ==================== ДАННЫЕ ДЛЯ ТЕСТА ====================

-- Комментарии для модулей
COMMENT ON TABLE subscription_modules IS 'Каталог доступных модулей подписки';
COMMENT ON TABLE user_subscriptions IS 'Активные подписки пользователей';
COMMENT ON TABLE user_subscription_modules IS 'Выбранные модули в подписке пользователя';
COMMENT ON TABLE user_subscription_history IS 'История изменений подписок';
COMMENT ON TABLE subscription_transactions IS 'Транзакции подписок';
