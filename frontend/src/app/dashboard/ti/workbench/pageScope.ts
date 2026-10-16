import type { WorkbenchCase } from './types'

export function firstParam(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] : value
}

export function selectedWorkbenchCaseId(cases: WorkbenchCase[], params: Record<string, string | string[] | undefined> | undefined) {
    const alertId = firstParam(params?.alertId)
    const caseId = firstParam(params?.caseId)
    const watchlistId = firstParam(params?.watchlistId)
    const organizationId = firstParam(params?.organizationId)
    return cases.find(item => workbenchCaseMatchesScope(item, { alertId, caseId, watchlistId, organizationId }))?.id
}

export function workbenchCaseMatchesScope(item: WorkbenchCase, scope: { alertId?: string, caseId?: string, watchlistId?: string, organizationId?: string }) {
    const scopeValues = [
        scope.alertId ? ['alert', scope.alertId] : undefined,
        scope.caseId ? ['case', scope.caseId] : undefined,
        scope.watchlistId ? ['watchlist', scope.watchlistId] : undefined,
        scope.organizationId ? ['organization', scope.organizationId] : undefined,
    ].filter(Boolean) as Array<[string, string]>
    if (!scopeValues.length) return false

    const refs = workbenchCaseReferenceRows(item)
    return scopeValues.some(([kind, value]) => refs.some(ref => ref.kind === kind && ref.value === value))
}

export function workbenchCaseReferenceRows(item: WorkbenchCase) {
    const rows: Array<{ kind: string, value: string }> = []
    rows.push({ kind: 'alert', value: item.id })
    for (const step of item.workflowPath || []) {
        if (!step.entityId) continue
        if (step.owner === 'alert') rows.push({ kind: 'alert', value: step.entityId })
        if (step.owner === 'case') rows.push({ kind: 'case', value: step.entityId })
        if (step.owner === 'org') rows.push({ kind: 'watchlist', value: step.entityId })
        if (step.href) rows.push(...scopeRefsFromHref(step.href))
    }
    for (const link of item.relatedLinks) rows.push(...scopeRefsFromHref(link.href))
    if (item.caseDetailHref) rows.push(...scopeRefsFromHref(item.caseDetailHref))
    for (const action of item.actions || []) {
        rows.push(...scopeRefsFromHref(action.href))
        rows.push(...scopeRefsFromBody(action.body))
    }
    return rows
}

export function scopeRefsFromHref(href: string) {
    const refs: Array<{ kind: string, value: string }> = []
    const [path, query = ''] = href.split('?')
    if (path.includes('/cases/')) {
        const caseId = path.split('/cases/')[1]
        if (caseId) refs.push({ kind: 'case', value: decodeURIComponent(caseId) })
    }
    const params = new URLSearchParams(query)
    for (const [key, kind] of [['alertId', 'alert'], ['alert', 'alert'], ['caseId', 'case'], ['watchlistId', 'watchlist'], ['organizationId', 'organization']] as const) {
        const value = params.get(key)
        if (value) refs.push({ kind, value })
    }
    return refs
}

export function scopeRefsFromBody(body: Record<string, unknown> | undefined) {
    if (!body) return []
    const refs: Array<{ kind: string, value: string }> = []
    const values = [
        ['alertId', 'alert'],
        ['caseId', 'case'],
        ['watchlistId', 'watchlist'],
        ['organizationId', 'organization'],
    ] as const
    for (const [key, kind] of values) {
        const value = body[key]
        if (typeof value === 'string' && value) refs.push({ kind, value })
    }
    return refs
}
