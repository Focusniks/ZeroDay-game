-- Migration: 004_create_game_fs_tables.sql
-- Файловая система игры с поддержкой онлайн-синхронизации

-- Таблица файлов пользователей
CREATE TABLE IF NOT EXISTS game_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES game_files(id) ON DELETE CASCADE,
    
    -- Метаданные файла
    name TEXT NOT NULL,
    path TEXT NOT NULL, -- Полный путь относительно корня пользователя
    kind TEXT NOT NULL CHECK (kind IN ('dir', 'file')),
    mime_type TEXT,
    extension TEXT,
    size_bytes BIGINT DEFAULT 0,
    
    -- Содержимое (для файлов)
    content_text TEXT, -- Для текстовых файлов
    content_hash TEXT, -- SHA256 хеш для бинарных файлов
    
    -- Метаданные
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ, -- Soft delete
    
    -- Индексы для производительности
    CONSTRAINT unique_user_path UNIQUE (user_id, path),
    CONSTRAINT check_path_format CHECK (path !~ '\\.\.' AND path !~ '^/')
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_game_files_user_id ON game_files(user_id);
CREATE INDEX IF NOT EXISTS idx_game_files_parent_id ON game_files(parent_id);
CREATE INDEX IF NOT EXISTS idx_game_files_path ON game_files(user_id, path);
CREATE INDEX IF NOT EXISTS idx_game_files_deleted ON game_files(deleted_at);
CREATE INDEX IF NOT EXISTS idx_game_files_kind ON game_files(user_id, kind);

-- Таблица для бинарного содержимого файлов (отдельно для производительности)
CREATE TABLE IF NOT EXISTS game_file_contents (
    file_id UUID PRIMARY KEY REFERENCES game_files(id) ON DELETE CASCADE,
    content_bytes BYTEA NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    content_type TEXT NOT NULL
);

-- Таблица истории операций (для аудита и отката)
CREATE TABLE IF NOT EXISTS game_file_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    operation TEXT NOT NULL CHECK (operation IN ('create', 'update', 'delete', 'move', 'rename')),
    file_id UUID REFERENCES game_files(id) ON DELETE SET NULL,
    old_path TEXT,
    new_path TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_game_file_operations_user_id ON game_file_operations(user_id);
CREATE INDEX IF NOT EXISTS idx_game_file_operations_file_id ON game_file_operations(file_id);

-- Триггер для обновления updated_at
CREATE OR REPLACE FUNCTION update_game_files_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_game_files_updated_at ON game_files;
CREATE TRIGGER trg_game_files_updated_at
    BEFORE UPDATE ON game_files
    FOR EACH ROW
    EXECUTE FUNCTION update_game_files_updated_at();

-- Функция для soft delete
CREATE OR REPLACE FUNCTION soft_delete_game_file()
RETURNS TRIGGER AS $$
BEGIN
    NEW.deleted_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- View для активных файлов (без удалённых)
CREATE OR REPLACE VIEW active_game_files AS
SELECT * FROM game_files WHERE deleted_at IS NULL;

-- Начальные данные: системные папки для каждого пользователя
-- (создаются триггером при создании пользователя)
