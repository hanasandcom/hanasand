export type AgentPolicyAction =
    | 'ai_prompt'
    | 'generated_tool_call'
    | 'share_file_write'
    | 'http_request'
    | 'vm_http_request'
    | 'browser_task'

export type AgentPolicyInput = {
    action: AgentPolicyAction
    actorId?: string | null
    approved?: boolean
    approvalId?: string | null
    target?: string | null
    method?: string | null
    path?: string | null
    content?: string | null
    prompt?: string | null
    context?: string | null
    metadata?: Record<string, unknown>
}

export type AgentPolicyDecision = {
    status: 'allowed' | 'blocked' | 'checkpoint_required'
    risk: 'low' | 'medium' | 'high' | 'critical'
    reason: string
    hardBlock: boolean
    safeAlternative: string
    requiredApproval?: string
}
