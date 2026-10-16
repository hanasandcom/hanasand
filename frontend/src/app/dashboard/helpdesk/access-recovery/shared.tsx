import type { InspectionMember, InspectionOrganizationMembership, SupportOperation } from './types'

export const inputClass = 'h-9 min-w-0 rounded-md border border-ui-border bg-ui-panel px-3 text-sm text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20'
export const textAreaClass = 'min-h-20 rounded-md border border-ui-border bg-ui-panel px-3 py-2 text-sm text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20'
export const primaryButton = 'h-9 rounded-md bg-ui-primary px-3 text-sm font-semibold text-ui-on-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-55'
export const secondaryButton = 'h-9 rounded-md border border-ui-border bg-ui-panel px-3 text-sm font-semibold text-ui-text transition hover:bg-ui-raised disabled:cursor-not-allowed disabled:opacity-55'
export const minimumAuditReasonMessage = 'Add a specific audit reason with at least 10 characters before continuing.'
export const operationTabs: Array<{ id: SupportOperation, label: string, detail: string }> = [
    { id: 'inspect', label: 'Inspect', detail: 'Members, invites, audit' },
    { id: 'impersonation', label: 'Session', detail: 'Start or end scoped access' },
    { id: 'recovery', label: 'Recovery', detail: 'Generate an invite' },
    { id: 'invite', label: 'Invite', detail: 'Resend or revoke' },
    { id: 'member', label: 'Role', detail: 'Recover member role' },
    { id: 'apiUsage', label: 'API usage', detail: 'Reset live buckets' },
    { id: 'decision', label: 'Review', detail: 'Approve or deny' },
    { id: 'queue', label: 'Queue', detail: 'Find recovery requests' },
]

export function Message({ value, tone = 'neutral' }: { value: string, tone?: 'neutral' | 'error' | 'success' }) {
    if (!value) return null
    const toneClass = tone === 'error'
        ? 'border-ui-danger/30 bg-ui-raised/10 text-ui-text'
        : tone === 'success'
            ? 'border-ui-success/30 bg-ui-success/10 text-ui-success'
            : 'border-ui-border bg-ui-canvas text-ui-muted'
    return <p className={`rounded-md border px-3 py-2 text-sm ${toneClass}`}>{value}</p>
}

export function CopyBlock({ value }: { value?: string }) {
    if (!value) return null
    return <pre className='max-h-36 overflow-auto rounded-md border border-ui-border bg-ui-canvas p-3 text-xs leading-5 text-ui-text'>{value}</pre>
}

export function isOrganizationMembership(member: InspectionMember): member is InspectionOrganizationMembership {
    return 'organizationId' in member || 'organization_id' in member || 'organizationName' in member || 'organization_name' in member
}

export function inspectionMemberId(member: InspectionMember, fallback: number) {
    if (isOrganizationMembership(member)) return member.organizationId || member.organization_id || `membership-${fallback}`
    return member.userId || member.user_id || `member-${fallback}`
}

export function inspectionMemberName(member: InspectionMember) {
    if (isOrganizationMembership(member)) return member.organizationName || member.organization_name || member.organizationId || member.organization_id || 'Organization'
    return member.name || member.userId || member.user_id || 'User'
}

export function OperationTab({
    active,
    label,
    detail,
    onClick,
}: {
    active: boolean
    label: string
    detail: string
    onClick: () => void
}) {
    return (
        <button
            type='button'
            aria-pressed={active}
            className={`rounded-md border px-3 py-2 text-left transition ${active ? 'border-ui-primary/35 bg-ui-primary/10 text-ui-primary' : 'border-ui-border bg-ui-canvas text-ui-muted hover:bg-ui-raised'}`}
            onClick={onClick}
        >
            <span className='block text-sm font-semibold'>{label}</span>
            <span className='mt-0.5 block text-xs text-ui-muted'>{detail}</span>
        </button>
    )
}

export function auditHref(requestId: string, action?: string) {
    const query = new URLSearchParams({ request: requestId, source: 'admin', service: 'hanasand-api' })
    if (action) query.set('action', action)
    return `/helpdesk?${query.toString()}`
}

export function supportReasonIsSpecific(reason: string) {
    return reason.trim().length >= 10
}

