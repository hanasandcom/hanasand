CREATE TABLE IF NOT EXISTS studio (
    id SMALLINT PRIMARY KEY,
    title TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 500),
    content TEXT NOT NULL DEFAULT '' CHECK (length(content) <= 1000000),
    revision BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE studio DROP CONSTRAINT IF EXISTS studio_id_check;
INSERT INTO studio (id, title, content) VALUES (1, 'Studio', '') ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS markdown_images (
    id UUID PRIMARY KEY,
    media_type TEXT NOT NULL CHECK (media_type IN ('image/png', 'image/jpeg', 'image/webp', 'image/gif')),
    data BYTEA NOT NULL CHECK (octet_length(data) <= 5242880),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    studio_public BOOLEAN NOT NULL DEFAULT FALSE
);
ALTER TABLE markdown_images ADD COLUMN IF NOT EXISTS studio_public BOOLEAN NOT NULL DEFAULT FALSE;
