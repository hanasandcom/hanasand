export type ModelToolStrategy = {
    route: 'tool_first' | 'small_model' | 'strong_model'
    difficulty: 'deterministic' | 'small' | 'strong'
    reason: string
    maxTokens: number
    temperature: number
    principles: string[]
}

export type AiToolRequest = {
    action?: string
    prompt?: string
    context?: string
    maxTokens?: number
    toolAction?: 'share_file_write'
    approved?: boolean
    approvalId?: string
    target?: string
    path?: string
    content?: string
    metadata?: Record<string, unknown>
    billingMode?: 'draft' | 'standard' | 'verified' | 'priority'
}
