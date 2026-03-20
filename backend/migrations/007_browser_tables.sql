-- Migration: 007_browser_tables.sql
-- Браузер ZeroDay: поисковая система, закладки, настройки, сайты

-- Таблица сайтов (approved sites)
CREATE TABLE IF NOT EXISTS browser_sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    url VARCHAR(512) NOT NULL UNIQUE,
    description TEXT,
    icon_url TEXT,
    category VARCHAR(64) DEFAULT 'general',
    is_indexed BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_browser_sites_url ON browser_sites(url);
CREATE INDEX IF NOT EXISTS idx_browser_sites_category ON browser_sites(category);
CREATE INDEX IF NOT EXISTS idx_browser_sites_indexed ON browser_sites(is_indexed);

-- Таблица поискового индекса (для полнотекстового поиска)
CREATE TABLE IF NOT EXISTS browser_search_index (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID REFERENCES browser_sites(id) ON DELETE CASCADE,
    title VARCHAR(512) NOT NULL,
    content TEXT,
    keywords TEXT[],
    rank INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_browser_search_index_site_id ON browser_search_index(site_id);
CREATE INDEX IF NOT EXISTS idx_browser_search_index_keywords ON browser_search_index USING GIN(keywords);

-- Таблица закладок пользователей
CREATE TABLE IF NOT EXISTS browser_bookmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    site_id UUID REFERENCES browser_sites(id) ON DELETE SET NULL,
    custom_url VARCHAR(512),
    custom_name VARCHAR(255),
    custom_icon_url TEXT,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT check_bookmark_target CHECK (site_id IS NOT NULL OR custom_url IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_browser_bookmarks_user_id ON browser_bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_browser_bookmarks_position ON browser_bookmarks(user_id, position);

-- Таблица настроек браузера пользователей
CREATE TABLE IF NOT EXISTS browser_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    homepage_url VARCHAR(512) DEFAULT 'zeroday://home',
    search_engine VARCHAR(64) DEFAULT 'zeroday',
    theme VARCHAR(32) DEFAULT 'dark',
    show_bookmarks_bar BOOLEAN NOT NULL DEFAULT TRUE,
    auto_play_media BOOLEAN NOT NULL DEFAULT TRUE,
    block_popups BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_browser_settings_user_id ON browser_settings(user_id);

-- Таблица истории браузера пользователей
CREATE TABLE IF NOT EXISTS browser_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    url VARCHAR(512) NOT NULL,
    title VARCHAR(512),
    visited_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_browser_history_user_id ON browser_history(user_id);
CREATE INDEX IF NOT EXISTS idx_browser_history_visited_at ON browser_history(user_id, visited_at DESC);

-- Триггер для обновления updated_at
CREATE OR REPLACE FUNCTION update_browser_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_browser_sites_updated_at ON browser_sites;
CREATE TRIGGER trg_browser_sites_updated_at
    BEFORE UPDATE ON browser_sites
    FOR EACH ROW
    EXECUTE FUNCTION update_browser_updated_at();

DROP TRIGGER IF EXISTS trg_browser_search_index_updated_at ON browser_search_index;
CREATE TRIGGER trg_browser_search_index_updated_at
    BEFORE UPDATE ON browser_search_index
    FOR EACH ROW
    EXECUTE FUNCTION update_browser_updated_at();

DROP TRIGGER IF EXISTS trg_browser_bookmarks_updated_at ON browser_bookmarks;
CREATE TRIGGER trg_browser_bookmarks_updated_at
    BEFORE UPDATE ON browser_bookmarks
    FOR EACH ROW
    EXECUTE FUNCTION update_browser_updated_at();

DROP TRIGGER IF EXISTS trg_browser_settings_updated_at ON browser_settings;
CREATE TRIGGER trg_browser_settings_updated_at
    BEFORE UPDATE ON browser_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_browser_updated_at();

-- Начальные данные: сайты
INSERT INTO browser_sites (name, url, description, icon_url, category) VALUES
('Домашняя', 'zeroday://home', 'Домашняя страница браузера', '/theme-icons/browser.svg', 'system'),
('Поиск', 'zeroday://search', 'Поисковая система ZeroDay', '/theme-icons/search.svg', 'system'),
('Закладки', 'zeroday://bookmarks', 'Ваши закладки', '/theme-icons/bookmark.svg', 'system'),
('Настройки', 'zeroday://settings', 'Настройки браузера', '/theme-icons/settings.svg', 'system'),
('Marketplace', 'zeroday://market', 'Торговая площадка ZeroDay', '/theme-icons/market.svg', 'services'),
('Форум', 'zeroday://forum', 'Форум сообщества', '/theme-icons/forum.svg', 'community'),
('Новости', 'zeroday://news', 'Новости ZeroDay', '/theme-icons/news.svg', 'community'),
('Профиль', 'zeroday://profile', 'Ваш профиль', '/theme-icons/profile.svg', 'user'),
('Почта', 'zeroday://mail', 'Электронная почта', '/theme-icons/mail.svg', 'services'),
('Файлы', 'zeroday://files', 'Файловое хранилище', '/theme-icons/files.svg', 'services'),
('Терминал', 'zeroday://terminal', 'Веб-терминал', '/theme-icons/terminal.svg', 'tools'),
('Документация', 'zeroday://docs', 'Документация ZeroDay', '/theme-icons/docs.svg', 'resources')
ON CONFLICT (url) DO NOTHING;

-- Начальные данные: поисковый индекс
INSERT INTO browser_search_index (site_id, title, content, keywords, rank)
SELECT 
    bs.id,
    bs.name,
    bs.description,
    ARRAY[LOWER(bs.name), LOWER(bs.category)],
    100
FROM browser_sites bs
WHERE bs.is_indexed = TRUE
ON CONFLICT DO NOTHING;

-- Начальные данные: настройки браузера по умолчанию
INSERT INTO browser_settings (user_id, homepage_url, search_engine, theme, show_bookmarks_bar, auto_play_media, block_popups)
SELECT 
    u.id,
    'zeroday://home',
    'zeroday',
    'dark',
    TRUE,
    TRUE,
    TRUE
FROM users u
ON CONFLICT (user_id) DO NOTHING;
