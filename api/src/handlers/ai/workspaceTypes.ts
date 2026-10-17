export type AiConversationRow = {
    id: string
    owner_id: string
    title: string
    preferred_model: string | null
    active_model: string | null
    model_strategy: 'auto' | 'pinned'
    workspace_kind: 'share' | 'repo' | null
    workspace_id: string | null
    share_ids: string[] | null
    workspace_meta: Record<string, unknown> | null
    archived_at: string | null
    created_at: string
    updated_at: string
    access_role?: 'owner' | 'reviewer' | 'editor'
}

export type AiMessageRow = {
    id: string
    conversation_id: string
    role: 'user' | 'assistant' | 'tool'
    content: string
    pending: boolean
    error: boolean
    model_name: string | null
    metadata: Record<string, unknown> | null
    created_at: string
    updated_at: string
}

export type CollaborationRow = {
    conversation_id: string
    user_id: string
    role: 'reviewer' | 'editor'
    invited_by: string | null
    created_at: string
    user_name: string | null
    user_avatar: string | null
}

export type UsageRow = {
    owner_id: string
    actor_id: string | null
    conversation_id: string | null
    deployment_id: string | null
    release_id: string | null
    kind: AIUsageEventKind
    units: number
    billable_units: number
    estimated_cost_nok: number
    billing_mode: string
    outcome: string
    metadata: Record<string, unknown> | null
    created_at: string
    actor_name: string | null
    owner_name: string | null
}

export type VmOwnershipRow = {
    name: string
    owner: string
    created_by: string
}

export type WorkspaceRepositoryRow = {
    id: string
    owner_id: string
    name: string
    full_name: string
    branch: string
    default_branch: string
    source_path: string
    source_url: string
    auth_mode: 'public' | 'github_token' | null
    auth_hint: string | null
    sync_status: 'ready' | 'syncing' | 'error'
    last_synced_at: string | null
    last_sync_error: string | null
    sync_history: AIRepositorySyncEvent[] | null
    stack_type: AIStackType
    stack_reason: string | null
    github_token_encrypted: string | null
    github_token_hint: string | null
    github_token_attached_at: string | null
    github_token_last_used_at: string | null
    github_token_last_validated_at: string | null
    truncated: boolean
    imported_at: string
}

export type WorkspaceRepositoryFileRow = {
    repository_id: string
    path: string
    name: string
    content: string
}
