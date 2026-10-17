export function createSmokeClient(context) {
    async function request(path, init = {}) {
        const response = await fetch(`${context.apiBase}${path}`, {
            ...init,
            headers: {
                ...(init.body ? { 'Content-Type': 'application/json' } : {}),
                ...(init.headers || {}),
            },
        })
        const text = await response.text()
        let body
        try {
            body = text ? JSON.parse(text) : null
        } catch {
            body = text
        }
        return { response, body }
    }

    async function signup(id, name) {
        const created = await request('/user', {
            method: 'POST',
            body: JSON.stringify({ id, name, password: context.password }),
        })
        expect(created.response.status === 201, `Failed to create user ${id}.`, created.body)
    }

    async function login(id) {
        const loggedIn = await request(`/auth/login/${encodeURIComponent(id)}`, {
            method: 'POST',
            body: JSON.stringify({ password: context.password }),
        })
        expect(Boolean(loggedIn.body?.token), `Failed to log in user ${id}.`, loggedIn.body)
        return loggedIn.body.token
    }

    async function createRecovery(requestId, email) {
        const recovery = await request(`/admin/support/organizations/${encodeURIComponent(context.orgId)}/access-recovery`, {
            method: 'POST',
            headers: authHeaders(context.adminOneId, context.adminOneToken, { 'x-request-id': requestId }),
            body: JSON.stringify({
                email,
                role: 'admin',
                reason: `High-risk owner recovery smoke ${requestId}`,
                context: `live-smoke ${requestId}`,
                approvalRequired: true,
            }),
        })
        expect(recovery.response.status === 201, `Failed to create recovery ${requestId}.`, recovery.body)
        expect(recovery.body?.recovery?.approvalStatus === 'pending_approval', 'High-risk recovery should start pending approval.', recovery.body)
        expect(recovery.body?.recovery?.invite?.status === 'revoked', 'High-risk recovery invite should be revoked until approved.', recovery.body)
        return recovery.body.recovery
    }

    async function searchApproval(params) {
        const result = await request(`/admin/support/access-recovery?${new URLSearchParams(params)}`, {
            headers: authHeaders(context.adminTwoId, context.adminTwoToken),
        })
        expect(result.response.status === 200, 'Approval search failed.', result.body)
        const approvals = result.body?.approvals || []
        expect(approvals.length === 1, 'Approval search should return exactly the requested recovery.', result.body)
        expect(approvals.every(approval => approval.requestId === params.request), 'Approval search leaked records outside the requested recovery.', result.body)
        return approvals
    }

    async function inspectSupportState(params) {
        const result = await request(`/admin/support/inspect?${new URLSearchParams(params)}`, {
            headers: authHeaders(context.adminTwoId, context.adminTwoToken),
        })
        expect(result.response.status === 200, 'Support inspection failed.', result.body)
        expect((result.body?.inspection?.auditEventIds || []).length > 0, 'Support inspection should include audit event ids.', result.body)
        expect((result.body?.inspection?.recoveryEligibility || []).length > 0, 'Support inspection should include recovery eligibility.', result.body)
        return result.body.inspection
    }

    async function supportInviteAction(inviteId, action, requestId) {
        const result = await request(`/admin/support/organizations/${encodeURIComponent(context.orgId)}/invites/${encodeURIComponent(inviteId)}/actions`, {
            method: 'POST',
            headers: authHeaders(context.adminTwoId, context.adminTwoToken, { 'x-request-id': requestId }),
            body: JSON.stringify({
                action,
                reason: `Support ${action} invite smoke request ${requestId}`,
                context: `live-smoke-invite-action ${requestId}`,
            }),
        })
        expect(result.response.status === 200, `Failed to ${action} invite ${inviteId}.`, result.body)
        expect(result.body?.inviteAction?.requestId === requestId, 'Invite action should return the audit request id.', result.body)
        expect((result.body?.inviteAction?.auditEventIds || []).length > 0, 'Invite action should return audit event ids.', result.body)
        expect(result.body?.inviteAction?.noSilentMembershipMutation === true, 'Invite action should declare no silent membership mutation.', result.body)
        return result.body.inviteAction
    }

    async function decide(requestId, action, expectedStatus) {
        const result = await request(`/admin/support/access-recovery/${encodeURIComponent(requestId)}/${action}`, {
            method: 'POST',
            headers: authHeaders(context.adminTwoId, context.adminTwoToken),
            body: JSON.stringify({
                reason: `${action} access recovery smoke request ${requestId}`,
                context: `live-smoke-decision ${requestId}`,
            }),
        })
        expect(result.response.status === 200, `Failed to ${action} recovery ${requestId}.`, result.body)
        expect(result.body?.decision?.status === expectedStatus, `Unexpected ${action} decision status.`, result.body)
        return result.body.decision
    }

    async function verifyUnauthorizedSearchIsBlocked() {
        const result = await request('/admin/support/access-recovery')
        expect([401, 403].includes(result.response.status), 'Unauthenticated approval search should be blocked.', result.body)
    }

    async function verifyUnauthorizedInviteActionIsBlocked(inviteId) {
        const result = await request(`/admin/support/organizations/${encodeURIComponent(context.orgId)}/invites/${encodeURIComponent(inviteId)}/actions`, {
            method: 'POST',
            body: JSON.stringify({
                action: 'revoke',
                reason: 'Unauthorized support invite action smoke reason',
            }),
        })
        expect([401, 403].includes(result.response.status), 'Unauthenticated invite support action should be blocked.', result.body)
    }

    return {
        request,
        signup,
        login,
        createRecovery,
        searchApproval,
        inspectSupportState,
        supportInviteAction,
        decide,
        verifyUnauthorizedSearchIsBlocked,
        verifyUnauthorizedInviteActionIsBlocked,
    }
}

function authHeaders(userId, token, extra = {}) {
    return { Authorization: `Bearer ${token}`, id: userId, ...extra }
}

function expect(condition, message, details) {
    if (condition) return
    const error = new Error(message)
    if (details !== undefined) error.details = details
    throw error
}
