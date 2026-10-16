import assert from 'node:assert/strict'
import Fastify, { type FastifyInstance } from 'fastify'
import { mock } from 'bun:test'

export type Row = Record<string, any>

export interface OrganizationSmokeJourney {
    organization: Row
    invite: Row
    pendingOpsInvite?: Row
    bulkInviteWorkflow?: Row
    staleDeactivatedInvite?: Row
    unknownUserInvite?: Row
    expiredInvite?: Row
    ownerWatchlistItem?: Row
    actorWatchlistItem?: Row
    readiness?: Row
    adminAlertCaseVisibility?: Row
    alertTermsExport?: Row
    adminPortalVisibility?: Row
}

type OrganizationApiRequestOptions = Parameters<FastifyInstance['inject']>[0]
type OrganizationApiResponse = Awaited<ReturnType<FastifyInstance['inject']>>

export interface OrganizationApiSmokeContext {
    app: FastifyInstance
    apiRequest: (options: OrganizationApiRequestOptions, expectedStatus: number) => Promise<OrganizationApiResponse>
    handlers: typeof import('../../src/handlers/organizations.ts')
    orgUtils: typeof import('../../src/utils/organizations.ts')
    users: Map<string, Row>
    tokens: Map<string, string>
    organizations: Map<string, Row>
    members: Map<string, Row>
    invites: Map<string, Row>
    watchlists: Map<string, Row>
    rules: Map<string, Row>
    serviceLogs: Row[]
    authHeaders: typeof authHeaders
    parseBody: typeof parseBody
    assertOrganizationTenantIdentity: typeof assertOrganizationTenantIdentity
    nowRow: typeof nowRow
    memberKey: typeof memberKey
    iso: typeof iso
    organizationSummary: typeof organizationSummary
}

export async function createOrganizationApiSmokeContext(): Promise<OrganizationApiSmokeContext> {
    const users = new Map<string, Row>([
        ['org_smoke_owner', { id: 'org_smoke_owner', name: 'Org Smoke Owner', avatar: '', email: 'owner@example.test', active: true }],
        ['org_smoke_admin', { id: 'org_smoke_admin', name: 'Org Smoke Admin', avatar: '', email: 'admin@example.test', active: true }],
        ['org_smoke_member', { id: 'org_smoke_member', name: 'Org Smoke Member', avatar: '', email: 'member@example.test', active: true }],
        ['org_smoke_viewer', { id: 'org_smoke_viewer', name: 'Org Smoke Viewer', avatar: '', email: 'viewer@example.test', active: true }],
        ['org_smoke_expired', { id: 'org_smoke_expired', name: 'Org Smoke Expired', avatar: '', email: 'expired@example.test', active: true }],
        ['org_smoke_deactivated', { id: 'org_smoke_deactivated', name: 'Org Smoke Deactivated', avatar: '', email: 'deactivated@example.test', active: false }],
        ['org_smoke_outsider', { id: 'org_smoke_outsider', name: 'Org Smoke Outsider', avatar: '', email: 'outsider@example.test', active: true }],
    ])
    const tokens = new Map([
        ['owner-token', 'org_smoke_owner'],
        ['admin-token', 'org_smoke_admin'],
        ['member-token', 'org_smoke_member'],
        ['viewer-token', 'org_smoke_viewer'],
        ['expired-token', 'org_smoke_expired'],
        ['deactivated-token', 'org_smoke_deactivated'],
        ['unknown-token', 'org_smoke_unknown'],
        ['outsider-token', 'org_smoke_outsider'],
    ])
    const organizations = new Map<string, Row>()
    const members = new Map<string, Row>()
    const invites = new Map<string, Row>()
    const watchlists = new Map<string, Row>()
    const rules = new Map<string, Row>()
    const serviceLogs: Row[] = []

    function organizationSummary(organizationId: string, role: string) {
        const org = organizations.get(organizationId)
        const activeMembers = [...members.values()].filter(member => member.organization_id === organizationId && member.status === 'active' && users.get(member.user_id)?.active !== false)
        const activeOwners = activeMembers.filter(member => member.role === 'owner')
        const activeAdmins = activeMembers.filter(member => member.role === 'owner' || member.role === 'admin')
        const pendingInvites = [...invites.values()].filter(invite => invite.organization_id === organizationId && invite.status === 'pending' && Date.parse(invite.expires_at) > Date.now())
        const sharedWatchlists = [...watchlists.values()].filter(item => item.organization_id === organizationId && !item.archived_at && item.status === 'active')
        return {
            ...org,
            role,
            member_count: activeMembers.length,
            owner_count: activeOwners.length,
            admin_count: activeAdmins.length,
            pending_invite_count: pendingInvites.length,
            shared_watchlist_count: sharedWatchlists.length,
        }
    }
    function organizationRow(row: Row) {
        return nowRow({
            status: 'active',
            default_webhook_policy: 'active_destinations',
            alert_visibility_policy: 'members',
            retention_days: 365,
            audit_safe_metadata: {},
            ...row,
        })
    }
    function nowRow(row: Row) {
        const at = iso()
        return { created_at: at, updated_at: at, ...row }
    }
    function rows(resultRows: Row[]) {
        return { rows: resultRows, rowCount: resultRows.length }
    }
    function memberKey(organizationId: string, userId: string) {
        return `${organizationId}:${userId}`
    }
    function iso() {
        return new Date().toISOString()
    }

    async function fakeRun(query: string, params: any[] = []) {
        const compact = query.replace(/\s+/g, ' ').trim()

        if (compact.startsWith('SET LOCAL lock_timeout=')) {
            return rows([])
        }

        if (compact.startsWith('SELECT COALESCE(SUM((quotas ->> $2)::int), 0)::int AS quota FROM billing_entitlements')) {
            return rows([{ quota: users.has(params[0]) && params[1] === 'watchTerms' ? 25 : 0 }])
        }

        if (compact.startsWith('SELECT used FROM billing_usage')) {
            return rows([{ used: 0 }])
        }

        if (compact.startsWith('WITH installed AS ( INSERT INTO rules(')) {
            const [organizationId, ruleId, name, family, severity, explanation, definition, source] = params
            const organization = organizations.get(organizationId)
            if (organization) {
                const key = `${organizationId}:${ruleId}`
                if (!rules.has(key)) {
                    rules.set(key, {
                        id: key,
                        organization_id: organizationId,
                        rule_id: ruleId,
                        version: '1',
                        name,
                        family,
                        severity,
                        explanation,
                        definition: JSON.parse(definition),
                        source,
                        enabled: true,
                    })
                }
            }
            return rows([])
        }

        if (compact.startsWith('WITH previous AS MATERIALIZED ( SELECT * FROM rules')) {
            const [organizationId, ruleId, previousDefinition, nextDefinition] = params
            for (const rule of rules.values()) {
                if (rule.rule_id !== ruleId || rule.source !== 'owned'
                    || (organizationId && rule.organization_id !== organizationId)
                    || JSON.stringify(rule.definition) !== previousDefinition
                    || !/^\d{1,9}$/.test(rule.version)) continue

                rule.definition = JSON.parse(nextDefinition)
                rule.version = String(Number(rule.version) + 1)
            }
            return rows([])
        }

        if (compact.startsWith('INSERT INTO system_events')) {
            return rows([])
        }

        if (compact.startsWith('SELECT r.rule_id AS id, r.organization_id, r.version, r.severity, r.source, r.enabled, r.definition FROM rules r JOIN organizations scope')) {
            const [organizationId, platformOrganizationId, applicationErrorRuleId] = params
            const scopedOrganizationId = organizationId ?? platformOrganizationId
            return rows([...rules.values()]
                .filter(rule => rule.organization_id === scopedOrganizationId)
                .filter(rule => ((rule.source === 'owned' || Object.hasOwn(rule.definition, 'protection')) && rule.enabled)
                    || rule.rule_id === applicationErrorRuleId)
                .filter(rule => rule.definition?.stage === 'analyze')
                .map(rule => ({
                    id: rule.rule_id,
                    organization_id: rule.organization_id,
                    version: rule.version,
                    severity: rule.severity,
                    source: rule.source,
                    enabled: rule.enabled,
                    definition: rule.definition,
                })))
        }

        if (compact.startsWith('SELECT id FROM organizations WHERE id = $1 FOR UPDATE') || compact.startsWith('SELECT status FROM organizations WHERE id = $1 FOR UPDATE')) {
            const organization = organizations.get(params[0])
            return rows(organization ? [{ id: organization.id, status: organization.status }] : [])
        }

        if (compact.startsWith('SELECT id FROM users WHERE id = ANY($1::text[])')) {
            return rows((params[0] as string[]).flatMap(id => users.has(id) ? [{ id }] : []))
        }

        if (compact.startsWith('SELECT slug FROM organizations') || compact.startsWith('SELECT id, slug FROM organizations')) {
            const [slug, like] = params
            const prefix = String(like).replace(/%$/, '')
            return rows([...organizations.values()].filter(org => org.slug === slug || org.slug.startsWith(prefix)).map(org => ({ slug: org.slug })))
        }

        if (compact.includes('INSERT INTO events')) {
            serviceLogs.push(...JSON.parse(params[0]).map((row: any) => ({
                service: row.normalized.service, host: row.normalized.host, level: row.normalized.level,
                message: row.normalized.message, metadata: row.normalized.metadata,
            })))
            return rows(JSON.parse(params[0]).map((row: any) => ({ id: row.id })))
        }

        if (compact.includes('WITH new_organization AS')) {
            const [id, name, slug, userId] = params
            const org = organizationRow({ id, name, slug, created_by: userId })
            organizations.set(id, org)
            members.set(memberKey(id, userId), nowRow({ organization_id: id, user_id: userId, role: 'owner', status: 'active', invited_by: userId, joined_at: iso() }))
            return rows([org])
        }

        if (compact.includes('FROM organizations o JOIN organization_members om')) {
            const [organizationId, userId] = params.length === 1 ? [undefined, params[0]] : params
            const activeMemberships = [...members.values()].filter(member => member.status === 'active')
            const scoped = activeMemberships.filter(member => member.user_id === userId
                && users.get(member.user_id)?.active !== false
                && !users.get(member.user_id)?.deletion_scheduled_at
                && (!organizationId || member.organization_id === organizationId))
            return rows(scoped.map(member => organizationSummary(member.organization_id, member.role)))
        }

        if (compact.startsWith('UPDATE organizations SET name')) {
            const [organizationId, name, slug, defaultWebhookPolicy, alertVisibilityPolicy, lifecycleStatus, retentionDays, auditSafeMetadata] = params
            const existing = organizations.get(organizationId)
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
            organizations.set(organizationId, updated)
            return rows([updated])
        }

        if (compact.startsWith('SELECT * FROM organization_invites WHERE id = $1')) {
            const [inviteId, organizationId] = params
            const invite = invites.get(inviteId)
            if (!invite) return rows([])
            if (organizationId && invite.organization_id !== organizationId) return rows([])
            return rows([invite])
        }

        if (compact.startsWith('SELECT COALESCE(status')) {
            const [organizationId] = params
            const organization = organizations.get(organizationId)
            return rows(organization ? [{ status: organization.status ?? 'active' }] : [])
        }

        if (compact.startsWith('SELECT * FROM organization_invites WHERE organization_id')) {
            if (compact.includes('lower(email) = lower($2)')) {
                const [organizationId, email] = params
                const invite = [...invites.values()].find(row => row.organization_id === organizationId && row.email.toLowerCase() === String(email).toLowerCase())
                return rows(invite ? [invite] : [])
            }

            return rows([...invites.values()].filter(invite => invite.organization_id === params[0] && invite.status === 'pending' && Date.parse(invite.expires_at) > Date.now()))
        }

        if (compact.startsWith('UPDATE organization_invites SET role = $3')) {
            const [organizationId, email, role, invitedBy, expiresAt] = params
            const existing = [...invites.values()].find(invite => invite.organization_id === organizationId && invite.email === email)
            if (!existing) return rows([])
            const updated = {
                ...existing,
                role,
                invited_by: invitedBy,
                status: 'pending',
                revoked_at: null,
                accepted_at: null,
                accepted_by: null,
                expires_at: expiresAt,
                created_at: iso(),
            }
            invites.set(updated.id, updated)
            return rows([updated])
        }

        if (compact.startsWith('INSERT INTO organization_invites')) {
            const [id, organizationId, email, role, invitedBy, expiresAt] = params
            const existing = [...invites.values()].find(invite => invite.organization_id === organizationId && invite.email === email)
            const invite = existing
                ? { ...existing, role, invited_by: invitedBy, status: 'pending', accepted_at: null, accepted_by: null, expires_at: expiresAt, created_at: iso() }
                : nowRow({ id, organization_id: organizationId, email, role, invited_by: invitedBy, status: 'pending', accepted_at: null, accepted_by: null, expires_at: expiresAt })
            invites.set(invite.id, invite)
            return rows([invite])
        }

        if (compact.startsWith('UPDATE organization_invites SET status = CASE WHEN $3')) {
            const [inviteId, organizationId, action, expiresAt] = params
            const existing = invites.get(inviteId)
            if (!existing || existing.organization_id !== organizationId || existing.status === 'accepted') return rows([])
            const updated = {
                ...existing,
                status: action === 'resend' ? 'pending' : 'revoked',
                revoked_at: action === 'revoke' ? iso() : null,
                accepted_at: null,
                accepted_by: null,
                expires_at: action === 'resend' ? expiresAt : existing.expires_at,
                created_at: action === 'resend' ? iso() : existing.created_at,
            }
            invites.set(inviteId, updated)
            return rows([updated])
        }

        if (compact.startsWith('UPDATE organization_invites SET status = \'pending\'')) {
            const [inviteId, organizationId, expiresAt] = params
            const existing = invites.get(inviteId)
            if (!existing || existing.organization_id !== organizationId || existing.status === 'accepted') return rows([])
            const updated = { ...existing, status: 'pending', accepted_at: null, accepted_by: null, expires_at: expiresAt, created_at: iso() }
            invites.set(inviteId, updated)
            return rows([updated])
        }

        if (compact.startsWith('UPDATE organization_invites SET status = \'revoked\'') && compact.includes('FROM users')) {
            const [organizationId, userId] = params
            const user = users.get(userId)
            if (!user?.email) return rows([])
            const revoked: Row[] = []
            for (const invite of invites.values()) {
                if (invite.organization_id !== organizationId || invite.status !== 'pending' || invite.email.toLowerCase() !== user.email.toLowerCase()) continue
                const updated = { ...invite, status: 'revoked', accepted_at: null, accepted_by: null }
                invites.set(invite.id, updated)
                revoked.push(updated)
            }
            return rows(revoked)
        }

        if (compact.startsWith('UPDATE organization_invites SET status = \'revoked\'')) {
            const [inviteId, organizationId] = params
            const existing = invites.get(inviteId)
            if (!existing || existing.organization_id !== organizationId || existing.status === 'accepted') return rows([])
            const updated = { ...existing, status: 'revoked', accepted_at: null, accepted_by: null }
            invites.set(inviteId, updated)
            return rows([updated])
        }

        if (compact.startsWith('UPDATE organization_invites SET status = \'accepted\'')) {
            const [inviteId, userId] = params
            const invite = invites.get(inviteId)
            if (!invite || invite.status !== 'pending' || Date.parse(invite.expires_at) <= Date.now()) return rows([])
            const organization = organizations.get(invite.organization_id)
            if (!organization || (organization.status ?? 'active') !== 'active') return rows([])
            const acceptingUser = users.get(userId)
            if (!acceptingUser || acceptingUser.active === false) return rows([])
            const existingMember = members.get(memberKey(invite.organization_id, userId))
            if (existingMember?.status === 'removed') return rows([])
            const acceptedInvite = { ...invite, status: 'accepted', accepted_by: userId, accepted_at: iso(), revoked_at: null }
            invites.set(inviteId, acceptedInvite)
            return rows([acceptedInvite])
        }

        if (compact.startsWith('SELECT status FROM organization_members')) {
            const [organizationId, userId] = params
            const member = members.get(memberKey(organizationId, userId))
            return rows(member ? [{ status: member.status }] : [])
        }

        if (compact.startsWith('SELECT COALESCE(active, TRUE) AS active FROM users')) {
            const user = users.get(params[0])
            return rows(user ? [{ active: user.active !== false }] : [])
        }

        if (compact.startsWith('UPDATE organization_members SET role = CASE')) {
            const [organizationId, userId, invitedRole, status, invitedBy, joinedAt] = params
            const key = memberKey(organizationId, userId)
            const existing = members.get(key)
            if (!existing) return rows([])
            const role = existing.role === 'owner' || existing.role === 'admin' && ['editor', 'reader', 'member', 'viewer'].includes(invitedRole)
                ? existing.role
                : existing.role === 'editor' && ['reader', 'member', 'viewer'].includes(invitedRole)
                    ? existing.role
                    : invitedRole
            const updated = {
                ...existing,
                role,
                status,
                removed_at: status === 'active' ? null : existing.removed_at,
                invited_by: invitedBy,
                joined_at: joinedAt || iso(),
            }
            members.set(key, updated)
            return rows([updated])
        }

        if (compact.startsWith('INSERT INTO organization_members (organization_id, user_id, role, status, invited_by, joined_at)')) {
            const [organizationId, userId, role, status, invitedBy, joinedAt] = params
            const member = nowRow({ organization_id: organizationId, user_id: userId, role, status, invited_by: invitedBy, joined_at: joinedAt || iso() })
            members.set(memberKey(organizationId, userId), member)
            return rows([member])
        }

        if (compact.includes('FROM organization_members om JOIN users u') && compact.includes('AND om.user_id = $2')) {
            const member = members.get(memberKey(params[0], params[1]))
            return rows(member
                ? [{ ...member, name: users.get(member.user_id)?.name ?? member.user_id, avatar: users.get(member.user_id)?.avatar ?? '' }]
                : [])
        }

        if (compact.startsWith('SELECT u.id AS user_id, COALESCE(u.active, TRUE) AS user_active')) {
            const [organizationId, email] = params
            const user = [...users.values()].find(row => row.email?.toLowerCase() === String(email).toLowerCase())
            if (!user) return rows([])
            const member = members.get(memberKey(organizationId, user.id))
            return rows([{
                user_id: user.id,
                user_active: user.active !== false,
                member_role: member?.role ?? null,
                member_status: member?.status ?? null,
            }])
        }

        if (compact.includes('FROM organization_members om JOIN users u')) {
            return rows([...members.values()]
                .filter(member => member.organization_id === params[0] && member.status === 'active')
                .map(member => ({ ...member, name: users.get(member.user_id)?.name ?? member.user_id, avatar: users.get(member.user_id)?.avatar ?? '' })))
        }

        if (compact.startsWith('SELECT COUNT(*)::int AS owner_count FROM organization_members')) {
            return rows([{
                owner_count: [...members.values()].filter(member =>
                    member.organization_id === params[0]
                    && member.status === 'active'
                    && member.role === 'owner'
                    && users.get(member.user_id)?.active !== false
                    && !users.get(member.user_id)?.deletion_scheduled_at
                ).length,
            }])
        }

        if (compact.startsWith('UPDATE organization_members SET status')) {
            const [organizationId, userId] = params
            const key = memberKey(organizationId, userId)
            const existing = members.get(key)
            if (!existing || existing.status !== 'active') return rows([])
            const removed = { ...existing, status: 'removed' }
            members.set(key, removed)
            return rows([{ ...removed, name: users.get(userId)?.name ?? userId, avatar: users.get(userId)?.avatar ?? '' }])
        }

        if (compact.startsWith('UPDATE organization_members SET role = $3')) {
            const [organizationId, userId, role] = params
            const key = memberKey(organizationId, userId)
            const existing = members.get(key)
            if (!existing || existing.status !== 'active') return rows([])
            const updated = { ...existing, role }
            members.set(key, updated)
            return rows([{ ...updated, name: users.get(userId)?.name ?? userId, avatar: users.get(userId)?.avatar ?? '' }])
        }

        if (compact.startsWith('UPDATE organization_members SET role = \'owner\'')) {
            const [organizationId, userId] = params
            const key = memberKey(organizationId, userId)
            const existing = members.get(key)
            if (!existing || existing.status !== 'active') return rows([])
            const updated = { ...existing, role: 'owner' }
            members.set(key, updated)
            return rows([{ ...updated, name: users.get(userId)?.name ?? userId, avatar: users.get(userId)?.avatar ?? '' }])
        }

        if (compact.startsWith('UPDATE organization_members SET role = \'admin\'')) {
            const [organizationId, userId] = params
            const key = memberKey(organizationId, userId)
            const existing = members.get(key)
            if (!existing || existing.status !== 'active' || existing.role !== 'owner') return rows([])
            members.set(key, { ...existing, role: 'admin' })
            return rows([{ user_id: userId }])
        }

        if (compact.includes('WITH promoted AS') || compact.includes('WITH viable_target AS')) {
            const [organizationId, targetUserId, previousOwnerId] = params
            const targetKey = memberKey(organizationId, targetUserId)
            const previousOwnerKey = memberKey(organizationId, previousOwnerId)
            const target = members.get(targetKey)
            const targetUser = users.get(targetUserId)
            const previousOwnerUser = users.get(previousOwnerId)
            if (!target || target.status !== 'active' || targetUser?.active === false || targetUser?.deletion_scheduled_at || previousOwnerUser?.active === false || previousOwnerUser?.deletion_scheduled_at) return rows([])
            const promoted = { ...target, role: 'owner' }
            members.set(targetKey, promoted)
            const previousOwner = members.get(previousOwnerKey)
            if (previousOwner?.status === 'active' && previousOwner.role === 'owner') {
                members.set(previousOwnerKey, { ...previousOwner, role: 'admin' })
            }
            return rows([{ ...promoted, name: users.get(targetUserId)?.name ?? targetUserId, avatar: users.get(targetUserId)?.avatar ?? '' }])
        }

        if (compact.startsWith('SELECT id FROM organization_watchlist_items')) {
            const [organizationId, kind, value] = params
            const existing = [...watchlists.values()].find(item => item.organization_id === organizationId && item.kind === kind && item.value.toLowerCase() === String(value).toLowerCase() && !item.archived_at)
            return rows(existing ? [{ id: existing.id }] : [])
        }

        if (compact.startsWith('SELECT COUNT(*)::int AS used FROM organization_watchlist_items')) {
            const [userId] = params
            const organizationIds = new Set([...members.values()]
                .filter(member => member.user_id === userId && member.status === 'active')
                .map(member => member.organization_id))
            const used = [...watchlists.values()].filter(item => organizationIds.has(item.organization_id)
                && !item.archived_at && item.status !== 'archived').length
            return rows([{ used }])
        }

        if (compact.startsWith('UPDATE organization_watchlist_items SET value')) {
            const [id, organizationId, value, notes, updatedBy, reason, requestId] = params
            const existing = watchlists.get(id)
            if (!existing || existing.organization_id !== organizationId) return rows([])
            const updated = { ...existing, value, notes, status: 'active', updated_by: updatedBy, lifecycle_reason: reason, lifecycle_request_id: requestId, updated_at: iso() }
            watchlists.set(id, updated)
            return rows([updated])
        }

        if (compact.startsWith('UPDATE organization_watchlist_items SET kind')) {
            const [id, organizationId, kind, value, notes, updatedBy, reason, requestId] = params
            const existing = watchlists.get(id)
            if (!existing || existing.organization_id !== organizationId || existing.archived_at || existing.status === 'archived') return rows([])
            const updated = { ...existing, kind, value, notes, updated_by: updatedBy, lifecycle_reason: reason, lifecycle_request_id: requestId, updated_at: iso() }
            watchlists.set(id, updated)
            return rows([updated])
        }

        if (compact.startsWith('INSERT INTO organization_watchlist_items')) {
            const [id, organizationId, kind, value, notes, createdBy, reason, requestId] = params
            const item = nowRow({ id, organization_id: organizationId, kind, value, notes, status: 'active', created_by: createdBy, updated_by: createdBy, lifecycle_reason: reason, lifecycle_request_id: requestId, archived_at: null })
            watchlists.set(id, item)
            return rows([item])
        }

        if (compact.startsWith('SELECT * FROM organization_watchlist_items')) {
            if (compact.includes('WHERE id = $1')) {
                const [itemId, organizationId] = params
                const existing = watchlists.get(itemId)
                return rows(existing && existing.organization_id === organizationId ? [existing] : [])
            }

            if (params.length === 1 && compact.includes('ORDER BY status ASC')) {
                const [organizationId] = params
                return rows([...watchlists.values()]
                    .filter(item => item.organization_id === organizationId)
                    .sort((a, b) => `${a.status}:${a.kind}:${a.value}`.localeCompare(`${b.status}:${b.kind}:${b.value}`)))
            }

            if (params.length === 1) {
                const [organizationId] = params
                return rows([...watchlists.values()].filter(item => item.organization_id === organizationId && !item.archived_at && item.status === 'active').sort((a, b) => `${a.kind}:${a.value}`.localeCompare(`${b.kind}:${b.value}`)))
            }

            const [organizationId, includeArchived, kind, status] = params
            return rows([...watchlists.values()]
                .filter(item => item.organization_id === organizationId)
                .filter(item => includeArchived || !item.archived_at)
                .filter(item => !kind || item.kind === kind)
                .filter(item => !status || item.status === status)
                .sort((a, b) => `${a.status}:${a.kind}:${a.value}`.localeCompare(`${b.status}:${b.kind}:${b.value}`)))
        }

        if (compact.startsWith('UPDATE organization_watchlist_items SET status = \'archived\'') && compact.includes('id = ANY')) {
            const [organizationId, itemIds, updatedBy, reason, requestId] = params
            const archived: Row[] = []
            for (const itemId of itemIds) {
                const existing = watchlists.get(itemId)
                if (!existing || existing.organization_id !== organizationId || existing.archived_at) continue
                const archivedItem = { ...existing, status: 'archived', archived_at: iso(), updated_by: updatedBy, lifecycle_reason: reason, lifecycle_request_id: requestId, updated_at: iso() }
                watchlists.set(itemId, archivedItem)
                archived.push(archivedItem)
            }
            return rows(archived)
        }

        if (compact.startsWith('UPDATE organization_watchlist_items SET status = \'archived\'')) {
            const [id, organizationId, updatedBy, reason, requestId] = params
            const existing = watchlists.get(id)
            if (!existing || existing.organization_id !== organizationId || existing.archived_at) return rows([])
            const archived = { ...existing, status: 'archived', archived_at: iso(), updated_by: updatedBy, lifecycle_reason: reason, lifecycle_request_id: requestId, updated_at: iso() }
            watchlists.set(id, archived)
            return rows([archived])
        }

        if (compact.startsWith('UPDATE organization_watchlist_items SET status = $3')) {
            const [id, organizationId, status, updatedBy, reason, requestId, action] = params
            const existing = watchlists.get(id)
            if (!existing || existing.organization_id !== organizationId || (existing.archived_at && action !== 'restore')) return rows([])
            const updated = {
                ...existing,
                status,
                archived_at: status === 'archived' ? iso() : action === 'restore' ? null : existing.archived_at,
                updated_by: updatedBy,
                lifecycle_reason: reason,
                lifecycle_request_id: requestId,
                updated_at: iso(),
            }
            watchlists.set(id, updated)
            return rows([updated])
        }

        if (compact.startsWith('UPDATE organizations SET updated_at')) {
            const org = organizations.get(params[0])
            if (org) organizations.set(params[0], { ...org, updated_at: iso() })
            return rows([])
        }

        throw new Error(`Unhandled organization smoke query: ${compact}`)
    }

    mock.module('#db', () => ({
        default: fakeRun,
        identityQueryOnce: fakeRun,
        isTransientDatabaseError: () => false,
        withDatabaseAdvisoryLock: async (_key: string, work: (query: typeof fakeRun) => Promise<unknown>) => work(async (query, params) => fakeRun(query, params)),
        withTransaction: async <T>(work: (query: typeof fakeRun) => Promise<T>) => work(async (query, params) => fakeRun(query, params)),
    }))
    mock.module('#utils/auth/tokenWrapper.ts', () => ({
        default: async (req: any) => {
            const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
            const id = String(req.headers.id || '')
            if (!tokens.has(token) || tokens.get(token) !== id) {
                return { valid: false, id, error: 'Unauthorized.' }
            }
            return { valid: true, id }
        },
    }))


    const handlers = await import('../../src/handlers/organizations.ts')
    const orgUtils = await import('../../src/utils/organizations.ts')
    const app = Fastify({ logger: false })

    try {
        app.post('/api/organizations', handlers.postOrganization)
        app.post('/api/organizations/invites/:inviteId/accept', handlers.postOrganizationInviteAccept)
        app.get('/api/organizations/:id/invites', handlers.getOrganizationInvites)
        app.post('/api/organizations/:id/invites', handlers.postOrganizationInvites)
        app.post('/api/organizations/:id/invites/:inviteId/actions', handlers.postOrganizationInviteAction)
        app.get('/api/organizations/:id/members', handlers.getOrganizationMembers)
        app.patch('/api/organizations/:id/members/:userId/role', handlers.patchOrganizationMemberRole)
        app.delete('/api/organizations/:id/members/:userId', handlers.deleteOrganizationMember)
        app.post('/api/organizations/:id/ownership-transfer', handlers.postOrganizationOwnershipTransfer)
        app.get('/api/organizations/:id/settings', handlers.getOrganizationSettings)
        app.put('/api/organizations/:id/settings', handlers.putOrganizationSettings)
        app.get('/api/organizations/:id/alert-readiness', handlers.getOrganizationAlertReadiness)
        app.get('/api/organizations/:id/alert-case-visibility', handlers.getOrganizationAlertCaseVisibility)
        app.get('/api/organizations/:id/watchlists/alert-terms', handlers.getOrganizationWatchlistAlertTerms)
        app.get('/api/organizations/:organizationId/watchlists/:itemId', handlers.getOrganizationWatchlist)
        app.get('/api/organizations/:id/watchlists', handlers.getOrganizationWatchlists)
        app.post('/api/organizations/:id/watchlists', handlers.postOrganizationWatchlist)
        app.post('/api/organizations/:id/watchlists/cleanup', handlers.postOrganizationWatchlistCleanup)
        app.put('/api/organizations/:organizationId/watchlists/:itemId', handlers.putOrganizationWatchlist)
        app.post('/api/organizations/:organizationId/watchlists/:itemId/actions', handlers.postOrganizationWatchlistAction)
        app.delete('/api/organizations/:organizationId/watchlists/:itemId', handlers.deleteOrganizationWatchlist)
        app.get('/api/organizations/:id', handlers.getOrganization)

        await app.ready()

        return {
            app,
            apiRequest: async (options, expectedStatus) => {
                const response = await app.inject(options)
                assert.equal(response.statusCode, expectedStatus, response.body)
                return response
            },
            handlers,
            orgUtils,
            users,
            tokens,
            organizations,
            members,
            invites,
            watchlists,
            rules,
            serviceLogs,
            authHeaders,
            parseBody,
            assertOrganizationTenantIdentity,
            nowRow,
            memberKey,
            iso,
            organizationSummary,
        }
    } catch (error) {
        await app.close()
        throw error
    }
}

function assertOrganizationTenantIdentity(value: Row, organizationId: string) {
    assert.equal(value.organizationId, organizationId)
    assert.equal(value.tenantId, organizationId)
}


function authHeaders(userId: string, token: string) {
    return {
        authorization: `Bearer ${token}`,
        id: userId,
    }
}

function parseBody(body: string) {
    return JSON.parse(body) as Row
}
