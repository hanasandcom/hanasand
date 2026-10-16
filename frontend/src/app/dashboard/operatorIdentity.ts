import type { DashboardViewerIdentity, DwmOrganizationMember, OperatorScope } from './operatorConsoleTypes'

export function resolveDashboardViewerIdentity(input: {
    userId?: string
    userName?: string
    userEmail?: string
    headerUserId?: string
    headerActor?: string
    members: DwmOrganizationMember[]
}): DashboardViewerIdentity {
    const explicitEmail = emailLike(input.userEmail) || emailLike(input.userName)
    const explicitUserId = normalizeIdentity(input.headerUserId) || normalizeIdentity(input.userId)
    const explicitActor = normalizeIdentity(input.headerActor) || explicitUserId || explicitEmail
    const activeMembers = input.members.filter(member => member.status === 'active')
    const matchedMember = activeMembers.find(member => {
        const candidates = [member.id, member.email, member.userId].map(normalizeIdentity).filter(Boolean)
        return candidates.some(candidate => [explicitEmail, explicitUserId, explicitActor].includes(candidate))
    })

    if (matchedMember) {
        return {
            userEmail: matchedMember.email,
            userId: matchedMember.userId || matchedMember.id,
            actor: explicitActor || matchedMember.email,
            source: 'org_member_match',
        }
    }

    if (explicitEmail || explicitUserId || explicitActor) {
        return {
            userEmail: explicitEmail,
            userId: explicitUserId,
            actor: explicitActor,
            source: 'session',
        }
    }

    if (activeMembers.length === 1) {
        return {
            userEmail: activeMembers[0].email,
            userId: activeMembers[0].userId || activeMembers[0].id,
            actor: activeMembers[0].email,
            source: 'single_active_org_member',
        }
    }

    return { source: 'anonymous' }
}

export function applyScope(target: URL, scope: OperatorScope, identity?: DashboardViewerIdentity) {
    if (scope.organizationId) {
        target.searchParams.set('organizationId', scope.organizationId)
        if (identity?.userEmail) target.searchParams.set('userEmail', identity.userEmail)
        if (identity?.userId) target.searchParams.set('userId', identity.userId)
        if (identity?.actor) target.searchParams.set('actor', identity.actor)
        return
    }
    target.searchParams.set('tenantId', scope.tenantId)
}

function emailLike(value: unknown) {
    const normalized = normalizeIdentity(value)
    return normalized && normalized.includes('@') ? normalized : undefined
}

function normalizeIdentity(value: unknown) {
    const normalized = String(value ?? '').trim().toLowerCase()
    return normalized || undefined
}
