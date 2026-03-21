-- Migration: 011_seed_browser_sites.sql
-- Seed данные для сайтов браузера с новыми доменами

-- Системные сайты
INSERT INTO browser_sites (name, url, description, icon_url, category, is_indexed) VALUES
('Домашняя', 'zeroday://home', 'Домашняя страница браузера ZeroDay', '/theme-icons/browser.svg', 'system', TRUE),
('Поиск', 'zeroday://search', 'Поисковая система ZeroDay - поиск по сайтам и сервисам', '/theme-icons/search.svg', 'system', TRUE),
('Закладки', 'zeroday://bookmarks', 'Ваши сохраненные закладки', '/theme-icons/bookmark.svg', 'system', TRUE),
('Настройки', 'zeroday://settings', 'Настройки браузера', '/theme-icons/settings.svg', 'system', TRUE)
ON CONFLICT (url) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    updated_at = NOW();

-- Мессенджер
INSERT INTO browser_sites (name, url, description, icon_url, category, is_indexed) VALUES
('Zerogram', 'https://zerogram.com', 'Современный мессенджер для общения с друзьями и коллегами. Групповые чаты, звонки, обмен файлами.', '/theme-icons/messenger.svg', 'services', TRUE)
ON CONFLICT (url) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    updated_at = NOW();

-- Криптокошелек
INSERT INTO browser_sites (name, url, description, icon_url, category, is_indexed) VALUES
('CryptoVault', 'https://cryptowallet.network', 'Безопасный криптокошелек для хранения и перевода криптовалют. Поддержка BTC, ETH, USDT, ZEROCOIN.', '/theme-icons/wallet.svg', 'services', TRUE)
ON CONFLICT (url) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    updated_at = NOW();

-- Хостинг провайдеры
INSERT INTO browser_sites (name, url, description, icon_url, category, is_indexed) VALUES
('CloudPro Hosting', 'https://cloudpro.network', 'Профессиональный хостинг для вашего бизнеса с гарантией 99.9% uptime. NVMe диски, DDoS защита, 24/7 поддержка.', '/theme-icons/cloud.svg', 'hosting', TRUE),
('FastHost', 'https://fasthost.network', 'Скоростной хостинг с NVMe дисками для максимальной производительности. Оптимизация для WordPress, CDN, Git интеграция.', '/theme-icons/server.svg', 'hosting', TRUE),
('SecureHost', 'https://securehost.network', 'Максимальная безопасность ваших данных с продвинутой защитой от атак. WAF, Malware сканер, Security аудит.', '/theme-icons/shield.svg', 'hosting', TRUE),
('BudgetHost', 'https://budgethost.network', 'Доступный хостинг без компромиссов в качестве. Идеально для начинающих сайтов и блогов.', '/theme-icons/piggy-bank.svg', 'hosting', TRUE)
ON CONFLICT (url) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    updated_at = NOW();

-- Интернет провайдеры
INSERT INTO browser_sites (name, url, description, icon_url, category, is_indexed) VALUES
('FreeNet', 'https://freenet.network', 'Бесплатный доступ в сеть ZeroDay! Базовая скорость для браузинга и социальных сетей.', '/theme-icons/wifi.svg', 'isp', TRUE),
('SpeedMax', 'https://speedmax.network', 'Максимальная скорость для геймеров и стримеров. Низкий пинг, игровой приоритет, статический IP.', '/theme-icons/zap.svg', 'isp', TRUE),
('HomeNet', 'https://homenet.network', 'Надежный интернет для дома и семьи. Безлимитный трафик, Wi-Fi роутер, ТВ пакеты.', '/theme-icons/home.svg', 'isp', TRUE),
('FiberOptic', 'https://fiberoptic.network', 'Оптоволоконный интернет нового поколения. Гигабитные скорости, симметричный канал, умный дом.', '/theme-icons/globe.svg', 'isp', TRUE)
ON CONFLICT (url) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    updated_at = NOW();

-- Дополнительные сервисы
INSERT INTO browser_sites (name, url, description, icon_url, category, is_indexed) VALUES
('Marketplace', 'zeroday://market', 'Торговая площадка ZeroDay - покупка и продажа цифровых товаров', '/theme-icons/market.svg', 'services', TRUE),
('Форум', 'zeroday://forum', 'Форум сообщества ZeroDay - обсуждение, помощь, новости', '/theme-icons/forum.svg', 'community', TRUE),
('Новости', 'zeroday://news', 'Новости ZeroDay - последние события и обновления', '/theme-icons/news.svg', 'community', TRUE),
('Профиль', 'zeroday://profile', 'Ваш профиль пользователя', '/theme-icons/profile.svg', 'user', TRUE),
('Почта', 'zeroday://mail', 'Электронная почта ZeroDay', '/theme-icons/mail.svg', 'services', TRUE),
('Файлы', 'zeroday://files', 'Файловое хранилище ZeroDay', '/theme-icons/files.svg', 'services', TRUE),
('Терминал', 'zeroday://terminal', 'Веб-терминал для выполнения команд', '/theme-icons/terminal.svg', 'tools', TRUE),
('Документация', 'zeroday://docs', 'Документация ZeroDay и HackScript', '/theme-icons/docs.svg', 'resources', TRUE)
ON CONFLICT (url) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    updated_at = NOW();

-- Обновляем поисковый индекс для всех сайтов
INSERT INTO browser_search_index (site_id, title, content, keywords, rank)
SELECT
    bs.id,
    bs.name,
    bs.description,
    ARRAY[LOWER(bs.name), LOWER(bs.category), LOWER(bs.description)],
    CASE 
        WHEN bs.category = 'system' THEN 100
        WHEN bs.category = 'services' THEN 80
        WHEN bs.category = 'isp' THEN 70
        WHEN bs.category = 'hosting' THEN 70
        ELSE 50
    END
FROM browser_sites bs
WHERE bs.is_indexed = TRUE
ON CONFLICT DO NOTHING;
