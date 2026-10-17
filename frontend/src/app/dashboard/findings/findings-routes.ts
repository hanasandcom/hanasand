export function findingsActionsHref(organizationId?: string) {
    return organizationId
        ? `/findings/actions?org=${encodeURIComponent(organizationId)}`
        : '/findings/actions'
}
