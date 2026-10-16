import run from '#db'

export default async function ensureImpersonationSchema() {
    await run(`
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'impersonation_sessions' AND column_name = 'target_id')
                    AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'impersonation_sessions' AND column_name = 'object_id') THEN
                    ALTER TABLE public.impersonation_sessions RENAME COLUMN target_id TO object_id;
                END IF;
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'impersonation_events' AND column_name = 'target_id')
                    AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'impersonation_events' AND column_name = 'object_id') THEN
                    ALTER TABLE public.impersonation_events RENAME COLUMN target_id TO object_id;
                END IF;
            END $$;
        `)
    await run(`
            DO $$
            BEGIN
                IF to_regclass('public.idx_impersonation_sessions_target_created') IS NOT NULL AND to_regclass('public.idx_impersonation_sessions_object_created') IS NULL THEN
                    ALTER INDEX public.idx_impersonation_sessions_target_created RENAME TO idx_impersonation_sessions_object_created;
                END IF;
                IF to_regclass('public.idx_impersonation_events_target_created') IS NOT NULL AND to_regclass('public.idx_impersonation_events_object_created') IS NULL THEN
                    ALTER INDEX public.idx_impersonation_events_target_created RENAME TO idx_impersonation_events_object_created;
                END IF;
                IF to_regclass('public.idx_impersonation_events_route_recent') IS NOT NULL AND to_regclass('public.idx_impersonation_events_route_recent_object') IS NULL THEN
                    ALTER INDEX public.idx_impersonation_events_route_recent RENAME TO idx_impersonation_events_route_recent_object;
                END IF;
            END $$;
        `)
    await run('ALTER TABLE IF EXISTS impersonation_sessions DROP CONSTRAINT IF EXISTS impersonation_sessions_target_id_fkey')
    await run('ALTER TABLE IF EXISTS impersonation_events DROP CONSTRAINT IF EXISTS impersonation_events_target_id_fkey')
    await run(`
            DO $$
            BEGIN
                IF to_regclass('public.impersonation_sessions') IS NOT NULL
                    AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'impersonation_sessions_object_id_fkey') THEN
                    ALTER TABLE public.impersonation_sessions ADD CONSTRAINT impersonation_sessions_object_id_fkey FOREIGN KEY (object_id) REFERENCES users(id) ON DELETE CASCADE;
                END IF;
                IF to_regclass('public.impersonation_events') IS NOT NULL
                    AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'impersonation_events_object_id_fkey') THEN
                    ALTER TABLE public.impersonation_events ADD CONSTRAINT impersonation_events_object_id_fkey FOREIGN KEY (object_id) REFERENCES users(id) ON DELETE CASCADE;
                END IF;
            END $$;
        `)
    await run(`
            CREATE TABLE IF NOT EXISTS impersonation_sessions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                token_hash TEXT NOT NULL UNIQUE,
                actor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                object_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                reason TEXT NOT NULL DEFAULT '',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                expires_at TIMESTAMPTZ NOT NULL,
                revoked_at TIMESTAMPTZ,
                revoked_by TEXT REFERENCES users(id) ON DELETE SET NULL
            )
        `)
    await run('CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_actor_active ON impersonation_sessions(actor_id, expires_at DESC) WHERE revoked_at IS NULL')
    await run('CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_target_created ON impersonation_sessions(object_id, created_at DESC)')
    await run(`
            CREATE TABLE IF NOT EXISTS impersonation_events (
                id BIGSERIAL PRIMARY KEY,
                session_id UUID REFERENCES impersonation_sessions(id) ON DELETE SET NULL,
                actor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                object_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                method TEXT NOT NULL DEFAULT '',
                path TEXT NOT NULL DEFAULT '',
                ip TEXT NOT NULL DEFAULT '',
                user_agent TEXT NOT NULL DEFAULT '',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `)
    await run('ALTER TABLE impersonation_events ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES impersonation_sessions(id) ON DELETE SET NULL')
    await run('CREATE INDEX IF NOT EXISTS idx_impersonation_events_actor_created ON impersonation_events(actor_id, created_at DESC)')
    await run('CREATE INDEX IF NOT EXISTS idx_impersonation_events_target_created ON impersonation_events(object_id, created_at DESC)')
    await run('CREATE INDEX IF NOT EXISTS idx_impersonation_events_route_recent ON impersonation_events(actor_id, object_id, method, path, created_at DESC)')
}
