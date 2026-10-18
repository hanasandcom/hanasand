import run from '#db'

const accessibleRepositoryIdsCte = `
    WITH accessible_conversations AS (
        SELECT ai_conversations.workspace_kind,
               ai_conversations.workspace_id,
               ai_conversations.workspace_meta
        FROM ai_conversations
        LEFT JOIN ai_conversation_collaborators AS collaborators
          ON collaborators.conversation_id = ai_conversations.id
         AND collaborators.user_id = $1
        WHERE ai_conversations.owner_id = $1
           OR collaborators.user_id = $1
    ),
    accessible_repo_ids AS (
        SELECT DISTINCT
            CASE
                WHEN workspace_kind = 'repo' THEN workspace_id
                WHEN jsonb_typeof(workspace_meta) = 'object' THEN workspace_meta->>'repositoryId'
                ELSE NULL
            END AS repository_id
        FROM accessible_conversations
    )
`

function conversationReadAccessPredicate(conversationAlias: string, collaboratorAlias: string) {
    return `(${conversationAlias}.owner_id = $1 OR ${collaboratorAlias}.user_id = $1)`
}

export function queryAccessibleConversations(ownerId: string, conversationId?: string) {
    const conversationFilter = conversationId === undefined ? '' : 'AND ai_conversations.id = $2'
    const ordering = conversationId === undefined ? 'ORDER BY updated_at DESC, created_at DESC' : ''
    const params = conversationId === undefined ? [ownerId] : [ownerId, conversationId]
    return run(`
        SELECT ai_conversations.*,
               CASE
                   WHEN ai_conversations.owner_id = $1 THEN 'owner'
                   ELSE collaborators.role
               END AS access_role
        FROM ai_conversations
        LEFT JOIN ai_conversation_collaborators AS collaborators
          ON collaborators.conversation_id = ai_conversations.id
         AND collaborators.user_id = $1
        WHERE ${conversationReadAccessPredicate('ai_conversations', 'collaborators')}
        ${conversationFilter}
        ${ordering}
    `, params)
}

export function queryAccessibleMessages(ownerId: string, conversationId?: string) {
    const conversationFilter = conversationId === undefined ? '' : 'AND ai_conversations.id = $2'
    const params = conversationId === undefined ? [ownerId] : [ownerId, conversationId]
    return run(`
        SELECT ai_messages.*
        FROM ai_messages
        JOIN ai_conversations
          ON ai_conversations.id = ai_messages.conversation_id
        LEFT JOIN ai_conversation_collaborators AS collaborators
          ON collaborators.conversation_id = ai_conversations.id
         AND collaborators.user_id = $1
        WHERE ${conversationReadAccessPredicate('ai_conversations', 'collaborators')}
        ${conversationFilter}
        ORDER BY ai_messages.created_at ASC
    `, params)
}

export function queryAccessibleRepositories(ownerId: string) {
    return run(`
        ${accessibleRepositoryIdsCte}
        SELECT repositories.*
        FROM ai_imported_repositories AS repositories
        WHERE repositories.owner_id = $1
           OR repositories.id IN (
                SELECT repository_id
                FROM accessible_repo_ids
                WHERE repository_id IS NOT NULL
           )
        ORDER BY repositories.imported_at DESC
    `, [ownerId])
}

export function queryAccessibleRepositoryFiles(ownerId: string) {
    return run(`
        ${accessibleRepositoryIdsCte}
        SELECT files.*
        FROM ai_imported_repository_files AS files
        JOIN ai_imported_repositories AS repositories
          ON repositories.id = files.repository_id
        WHERE repositories.owner_id = $1
           OR repositories.id IN (
                SELECT repository_id
                FROM accessible_repo_ids
                WHERE repository_id IS NOT NULL
           )
        ORDER BY files.path ASC
    `, [ownerId])
}

export function queryAccessibleDeployments(ownerId: string) {
    return run(`
        SELECT ai_deployments.*
        FROM ai_deployments
        JOIN ai_conversations
          ON ai_conversations.id = ai_deployments.conversation_id
        LEFT JOIN ai_conversation_collaborators AS collaborators
          ON collaborators.conversation_id = ai_deployments.conversation_id
         AND collaborators.user_id = $1
        WHERE ai_deployments.owner_id = $1
           OR collaborators.user_id = $1
        ORDER BY ai_deployments.updated_at DESC, ai_deployments.created_at DESC
        LIMIT 25
    `, [ownerId])
}

export function queryAccessibleCollaborators(ownerId: string, conversationId?: string) {
    const conversationFilter = conversationId === undefined ? '' : 'AND collaborators.conversation_id = $2'
    const params = conversationId === undefined ? [ownerId] : [ownerId, conversationId]
    return run(`
        SELECT collaborators.*, users.name AS user_name, users.avatar AS user_avatar
        FROM ai_conversation_collaborators AS collaborators
        LEFT JOIN users
          ON users.id = collaborators.user_id
        WHERE collaborators.conversation_id IN (
            SELECT ai_conversations.id
            FROM ai_conversations
            LEFT JOIN ai_conversation_collaborators AS own_access
              ON own_access.conversation_id = ai_conversations.id
             AND own_access.user_id = $1
            WHERE ${conversationReadAccessPredicate('ai_conversations', 'own_access')}
        )
        ${conversationFilter}
        ORDER BY collaborators.created_at ASC
    `, params)
}

export function queryAccessibleReleases(ownerId: string) {
    return run(`
        SELECT ai_releases.*
        FROM ai_releases
        JOIN ai_conversations
          ON ai_conversations.id = ai_releases.conversation_id
        LEFT JOIN ai_conversation_collaborators AS collaborators
          ON collaborators.conversation_id = ai_releases.conversation_id
         AND collaborators.user_id = $1
        WHERE ai_releases.owner_id = $1
           OR collaborators.user_id = $1
        ORDER BY ai_releases.updated_at DESC, ai_releases.created_at DESC
        LIMIT 40
    `, [ownerId])
}

export function queryAccessibleUsageEvents(ownerId: string) {
    return run(`
        SELECT events.*, actor.name AS actor_name, owner.name AS owner_name
        FROM ai_usage_events AS events
        LEFT JOIN users AS actor
          ON actor.id = events.actor_id
        LEFT JOIN users AS owner
          ON owner.id = events.owner_id
        LEFT JOIN ai_conversation_collaborators AS collaborators
          ON collaborators.conversation_id = events.conversation_id
         AND collaborators.user_id = $1
        WHERE events.owner_id = $1
           OR collaborators.user_id = $1
        ORDER BY events.created_at DESC
        LIMIT 40
    `, [ownerId])
}

export function queryVmOwnership(vmNames: string[]) {
    return run(`
        SELECT name, owner, created_by
        FROM vms
        WHERE name = ANY($1::text[])
    `, [vmNames])
}
