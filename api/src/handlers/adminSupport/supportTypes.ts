export type AccessRecoveryApprovalRow = {
    request_id: string
    organization_id: string
    invite_id: string
    target_user_id?: string | null
    requested_by: string
    requested_reason: string
    request_context: string
    approval_required: boolean
    status: 'pending' | 'approved' | 'denied' | 'not_required'
    approved_by?: string | null
    approved_at?: string | null
    denied_by?: string | null
    denied_at?: string | null
    decision_reason?: string | null
    outcome: 'success' | 'denied' | 'failed'
    expires_at: string
    created_at: string
    updated_at: string
    email?: string
    role?: string
    invite_status?: string
    organization_name?: string
    audit_events?: unknown
}
