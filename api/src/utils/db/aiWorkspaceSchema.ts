import run from '#db'

export default async function ensureAiWorkspaceSchema() {
    await run(`
            CREATE TABLE IF NOT EXISTS ai_conversations (
                id TEXT PRIMARY KEY,
                owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                title TEXT NOT NULL DEFAULT 'New chat',
                preferred_model TEXT,
                active_model TEXT,
                model_strategy TEXT NOT NULL DEFAULT 'auto' CHECK (model_strategy IN ('auto', 'pinned')),
                workspace_kind TEXT CHECK (workspace_kind IN ('share', 'repo')),
                workspace_id TEXT,
                share_ids TEXT[] NOT NULL DEFAULT '{}'::text[],
                workspace_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
                archived_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `)
    await run('ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ')
    await run(`
            CREATE TABLE IF NOT EXISTS ai_conversation_collaborators (
                conversation_id TEXT NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                role TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('reviewer', 'editor')),
                invited_by TEXT REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                last_accessed_at TIMESTAMPTZ,
                PRIMARY KEY (conversation_id, user_id)
            )
        `)
    await run('CREATE INDEX IF NOT EXISTS idx_ai_conversation_collaborators_user ON ai_conversation_collaborators(user_id, created_at DESC)')
    await run(`
            CREATE TABLE IF NOT EXISTS ai_messages (
                id TEXT PRIMARY KEY,
                conversation_id TEXT NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
                role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
                content TEXT NOT NULL DEFAULT '',
                pending BOOLEAN NOT NULL DEFAULT FALSE,
                error BOOLEAN NOT NULL DEFAULT FALSE,
                model_name TEXT,
                metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `)
    await run(`
            CREATE TABLE IF NOT EXISTS ai_imported_repositories (
                id TEXT PRIMARY KEY,
                owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                full_name TEXT NOT NULL,
                branch TEXT NOT NULL,
                default_branch TEXT NOT NULL DEFAULT 'main',
                source_path TEXT NOT NULL DEFAULT '',
                source_url TEXT NOT NULL,
                auth_mode TEXT NOT NULL DEFAULT 'public',
                auth_hint TEXT,
                github_token_encrypted TEXT,
                github_token_hint TEXT,
                github_token_attached_at TIMESTAMPTZ,
                github_token_last_used_at TIMESTAMPTZ,
                github_token_last_validated_at TIMESTAMPTZ,
                sync_status TEXT NOT NULL DEFAULT 'ready',
                last_synced_at TIMESTAMPTZ,
                last_sync_error TEXT,
                sync_history JSONB NOT NULL DEFAULT '[]'::jsonb,
                truncated BOOLEAN NOT NULL DEFAULT FALSE,
                imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `)
    await run('ALTER TABLE ai_imported_repositories ADD COLUMN IF NOT EXISTS default_branch TEXT NOT NULL DEFAULT \'main\'')
    await run('ALTER TABLE ai_imported_repositories ADD COLUMN IF NOT EXISTS source_path TEXT NOT NULL DEFAULT \'\'')
    await run('ALTER TABLE ai_imported_repositories ADD COLUMN IF NOT EXISTS auth_mode TEXT NOT NULL DEFAULT \'public\'')
    await run('ALTER TABLE ai_imported_repositories ADD COLUMN IF NOT EXISTS auth_hint TEXT')
    await run('ALTER TABLE ai_imported_repositories ADD COLUMN IF NOT EXISTS github_token_encrypted TEXT')
    await run('ALTER TABLE ai_imported_repositories ADD COLUMN IF NOT EXISTS github_token_hint TEXT')
    await run('ALTER TABLE ai_imported_repositories ADD COLUMN IF NOT EXISTS github_token_attached_at TIMESTAMPTZ')
    await run('ALTER TABLE ai_imported_repositories ADD COLUMN IF NOT EXISTS github_token_last_used_at TIMESTAMPTZ')
    await run('ALTER TABLE ai_imported_repositories ADD COLUMN IF NOT EXISTS github_token_last_validated_at TIMESTAMPTZ')
    await run('ALTER TABLE ai_imported_repositories ADD COLUMN IF NOT EXISTS sync_status TEXT NOT NULL DEFAULT \'ready\'')
    await run('ALTER TABLE ai_imported_repositories ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ')
    await run('ALTER TABLE ai_imported_repositories ADD COLUMN IF NOT EXISTS last_sync_error TEXT')
    await run('ALTER TABLE ai_imported_repositories ADD COLUMN IF NOT EXISTS sync_history JSONB NOT NULL DEFAULT \'[]\'::jsonb')
    await run('ALTER TABLE ai_imported_repositories ADD COLUMN IF NOT EXISTS truncated BOOLEAN NOT NULL DEFAULT FALSE')
    await run('ALTER TABLE ai_imported_repositories ADD COLUMN IF NOT EXISTS stack_type TEXT NOT NULL DEFAULT \'unknown\'')
    await run('ALTER TABLE ai_imported_repositories ADD COLUMN IF NOT EXISTS stack_reason TEXT')
    await run(`
            CREATE TABLE IF NOT EXISTS ai_imported_repository_files (
                repository_id TEXT NOT NULL REFERENCES ai_imported_repositories(id) ON DELETE CASCADE,
                path TEXT NOT NULL,
                name TEXT NOT NULL,
                content TEXT NOT NULL DEFAULT '',
                PRIMARY KEY (repository_id, path)
            )
        `)
    await run('CREATE INDEX IF NOT EXISTS idx_ai_conversations_owner_updated_at ON ai_conversations(owner_id, updated_at DESC)')
    await run('CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_created_at ON ai_messages(conversation_id, created_at ASC)')
    await run('CREATE INDEX IF NOT EXISTS idx_ai_repositories_owner_imported_at ON ai_imported_repositories(owner_id, imported_at DESC)')
}
