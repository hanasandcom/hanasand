type DwmRequestScope = {
    tenantId: string
    organizationId?: string
    error?: string
}

export function resolveDwmRequestScope(input: {
    identityId: string
    params: Pick<URLSearchParams, 'get'>
    headers: Pick<Headers, 'get'>
    body?: Record<string, unknown>
    fallbackOrganizationId?: string
}): DwmRequestScope {
    const organizationIds = [
        input.params.get('org'),
        input.params.get('organizationId'),
        input.params.get('orgId'),
        input.headers.get('x-organization-id'),
        clean(input.body?.organizationId),
        clean(input.body?.orgId),
        ...nestedScopeRecords(input.body).flatMap(item => [clean(item.organizationId), clean(item.orgId)]),
    ].map(clean).filter(Boolean)
    const distinctOrganizationIds = [...new Set(organizationIds)]
    if (distinctOrganizationIds.length > 1) {
        return { tenantId: input.identityId, error: 'Organization scope is inconsistent across the request.' }
    }
    const organizationId = distinctOrganizationIds[0] || input.fallbackOrganizationId
    return {
        tenantId: organizationId || input.identityId,
        ...(organizationId ? { organizationId } : {}),
    }
}

export function withDwmRequestScope(body: Record<string, unknown>, scope: Pick<DwmRequestScope, 'tenantId' | 'organizationId'>) {
    const applyScope = (value: Record<string, unknown>) => {
        const scoped: Record<string, unknown> = { ...value, tenantId: scope.tenantId }
        delete scoped.organizationId
        delete scoped.orgId
        if (scope.organizationId) {
            scoped.organizationId = scope.organizationId
            scoped.orgId = scope.organizationId
        }
        return scoped
    }
    const scoped = applyScope(body)
    if (Array.isArray(body.items)) {
        scoped.items = body.items.map(item => isRecord(item) ? applyScope(item) : item)
    }
    return scoped
}

export function parseJsonObject(value: string) {
    try {
        const parsed = JSON.parse(value) as unknown
        return isRecord(parsed) ? parsed : null
    } catch {
        return null
    }
}

function clean(value: unknown) {
    return typeof value === 'string' ? value.trim() : ''
}

function nestedScopeRecords(body: Record<string, unknown> | undefined) {
    return Array.isArray(body?.items) ? body.items.filter(isRecord) : []
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
