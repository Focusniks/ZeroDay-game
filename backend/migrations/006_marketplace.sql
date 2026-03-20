CREATE TABLE IF NOT EXISTS marketplace_lots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(160) NOT NULL,
    category VARCHAR(32) NOT NULL,
    kind VARCHAR(32) NOT NULL,
    description TEXT NOT NULL,
    price INTEGER NOT NULL CHECK (price > 0),
    rating NUMERIC(3,2) NOT NULL DEFAULT 0,
    img TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_lots_created_at ON marketplace_lots(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_lots_category ON marketplace_lots(category);
CREATE INDEX IF NOT EXISTS idx_marketplace_lots_seller ON marketplace_lots(seller_user_id);

CREATE TABLE IF NOT EXISTS marketplace_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lot_id UUID NOT NULL REFERENCES marketplace_lots(id) ON DELETE CASCADE,
    buyer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    seller_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(24) NOT NULL DEFAULT 'requested',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (lot_id, buyer_user_id)
);

CREATE INDEX IF NOT EXISTS idx_marketplace_threads_lot ON marketplace_threads(lot_id);

CREATE TABLE IF NOT EXISTS marketplace_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID NOT NULL REFERENCES marketplace_threads(id) ON DELETE CASCADE,
    from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message_text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_messages_thread ON marketplace_messages(thread_id, created_at ASC);
