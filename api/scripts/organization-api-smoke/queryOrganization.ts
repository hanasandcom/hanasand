import { memberKey, nowRow, organizationRow, organizationSummary, rows, iso } from './rowHelpers.ts'
import type { SmokeQueryHandler } from './queryTypes.ts'

export const handleOrganizationQueries: SmokeQueryHandler = (compact, params, state) => {
    if (compact.startsWith('SELECT id FROM organizations WHERE id = $1 FOR UPDATE') || compact.startsWith('SELECT status FROM organizations WHERE id = $1 FOR UPDATE')) {
        const organization = state.organizations.get(params[0])
        return rows(organization ? [{ id: organization.id, status: organization.status }] : [])
    }

    if (compact.startsWith('SELECT id FROM users WHERE id = ANY($1::text[])')) {
        return rows((params[0] as string[]).flatMap(id => state.users.has(id) ? [{ id }] : []))
    }

    if (compact.startsWith('SELECT slug FROM organizations') || compact.startsWith('SELECT id, slug FROM organizations')) {
        const [slug, like] = params
        const prefix = String(like).replace(/%$/, '')
        return rows([...state.organizations.values()].filter(org => org.slug === slug || org.slug.startsWith(prefix)).map(org => ({ slug: org.slug })))
    }

    if (compact.includes('INSERT INTO events')) {
        const events = JSON.parse(params[0])
        state.serviceLogs.push(...events.map((row: any) => ({
            service: row.normalized.service,
            host: row.normalized.host,
            level: row.normalized.level,
            message: row.normalized.message,
            metadata: row.normalized.metadata,
        })))
        return rows(events.map((row: any) => ({ id: row.id })))
    }

    if (compact.includes('WITH new_organization AS')) {
        const [id, name, slug, userId] = params
        const org = organizationRow({ id, name, slug, created_by: userId })
        state.organizations.set(id, org)
        state.members.set(memberKey(id, userId), nowRow({ organization_id: id, user_id: userId, role: 'owner', status: 'active', invited_by: userId, joined_at: iso() }))
        return rows([org])
    }

    if (compact.includes('FROM organizations o JOIN organization_members om')) {
        const [organizationId, userId] = params.length === 1 ? [undefined, params[0]] : params
        const activeMemberships = [...state.members.values()].filter(member => member.status === 'active')
        const scoped = activeMemberships.filter(member => member.user_id === userId
            && state.users.get(member.user_id)?.active !== false
            && !state.users.get(member.user_id)?.deletion_scheduled_at
            && (!organizationId || member.organization_id === organizationId))
        return rows(scoped.map(member => organizationSummary(state, member.organization_id, member.role)))
    }

    if (compact.startsWith('UPDATE organizations SET name')) {
        const [organizationId, name, slug, defaultWebhookPolicy, alertVisibilityPolicy, lifecycleStatus, retentionDays, auditSafeMetadata] = params
        const existing = state.organizations.get(organizationId)
        if (!existing) return rows([])
        const updated = {
            ...existing,
            name: name ?? existing.name,
            slug: slug ?? existing.slug,
            default_webhook_policy: defaultWebhookPolicy ?? existing.default_webhook_policy,
            alert_visibility_policy: alertVisibilityPolicy ?? existing.alert_visibility_policy,
            status: lifecycleStatus ?? existing.status,
            retention_days: retentionDays ?? existing.retention_days,
            audit_safe_metadata: auditSafeMetadata ? JSON.parse(auditSafeMetadata) : existing.audit_safe_metadata,
            updated_at: iso(),
        }
        state.organizations.set(organizationId, updated)
        return rows([updated])
    }

    return undefined
}

export const handleOrganizationTimestampQuery: SmokeQueryHandler = (compact, params, state) => {
    if (!compact.startsWith('UPDATE organizations SET updated_at')) return undefined
    const org = state.organizations.get(params[0])
    if (org) state.organizations.set(params[0], { ...org, updated_at: iso() })
    return rows([])
}
