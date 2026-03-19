CREATE TABLE IF NOT EXISTS news_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(160) UNIQUE NOT NULL,
    title_ru VARCHAR(255) NOT NULL,
    title_en VARCHAR(255) NOT NULL,
    excerpt_ru TEXT NOT NULL,
    excerpt_en TEXT NOT NULL,
    content_ru TEXT NOT NULL,
    content_en TEXT NOT NULL,
    cover_url TEXT,
    published BOOLEAN NOT NULL DEFAULT FALSE,
    published_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_news_posts_published ON news_posts(published);
CREATE INDEX IF NOT EXISTS idx_news_posts_published_at ON news_posts(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_posts_slug ON news_posts(slug);

INSERT INTO news_posts (
    slug,
    title_ru, title_en,
    excerpt_ru, excerpt_en,
    content_ru, content_en,
    cover_url, published, published_at
) VALUES
(
    'zeroday-cabinet-launch',
    'Запуск веб-кабинета ZeroDay',
    'ZeroDay Web Cabinet Launch',
    'Мы запустили веб-кабинет с доступом к профилю и игровым показателям.',
    'We launched a web cabinet with profile and progression overview.',
    'Новый веб-сайт ZeroDay получил раздел личного кабинета. Теперь можно входить через email или username, просматривать профиль и ключевые игровые параметры. Следующий этап — новости, гайды и расширенный профиль.',
    'The new ZeroDay website now includes a personal cabinet. You can sign in with email or username and view profile and core progression data. Next stage includes richer news, guides, and profile settings.',
    NULL,
    TRUE,
    NOW()
),
(
    'linux-ux-update',
    'Обновление Linux-стиля в интерфейсе',
    'Linux UX Update',
    'Игровой UI продолжает сближаться с реальным Linux-окружением.',
    'The game UI keeps moving closer to a real Linux environment.',
    'Мы доработали рабочий стол, окна приложений, контекстные меню и поведение панели задач. Отдельное внимание уделено ощущениям системы и интерактивности.',
    'We improved desktop behavior, app windows, context menus, and taskbar interactions. The main focus is on immersive system feel and interactivity.',
    NULL,
    TRUE,
    NOW() - INTERVAL '1 day'
)
ON CONFLICT (slug) DO NOTHING;
