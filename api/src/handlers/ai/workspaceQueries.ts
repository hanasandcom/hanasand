import run from '#db'

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
        WHERE (
            ai_conversations.owner_id = $1
            OR collaborators.user_id = $1
        )
        ${conversationFilter}
        ${ordering}
    `, params)
}

export function queryAccessibleMessages(ownerId: string) {
    return run(`
        SELECT ai_messages.*
        FROM ai_messages
        JOIN ai_conversations
          ON ai_conversations.id = ai_messages.conversation_id
        LEFT JOIN ai_conversation_collaborators AS collaborators
          ON collaborators.conversation_id = ai_conversations.id
         AND collaborators.user_id = $1
        WHERE ai_conversations.owner_id = $1
           OR collaborators.user_id = $1
        ORDER BY ai_messages.created_at ASC
    `, [ownerId])
}
