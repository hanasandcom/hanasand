import { tokenDigest, expect } from './api.mjs'

export async function startSession(context, api, adminToken) {
    const { adminId, targetId, pool } = context
    const started = await api.request('/impersonation/start', {
        method: 'POST',
        headers: api.authHeaders(adminId, adminToken),
        body: JSON.stringify({ target_id: targetId, reason: 'impersonation regression smoke', duration_minutes: 15, scope: ['read_profile', 'read_org'] }),
    })
    expect(started.response.status === 200, 'Admin start should succeed.', started.body)
    expect(started.body?.token && started.body.token !== targetId, 'Start should return an opaque token.', started.body)
    expect(started.body?.session?.target?.id === targetId, 'Start should return the target.', started.body)
    expect(started.body?.session?.reason === 'impersonation regression smoke', 'Start should echo the audited reason.', started.body)
    expect(started.body?.session?.duration_minutes === 15, 'Start should honor bounded duration.', started.body)
    expect(started.body?.session?.scope?.includes('read_org'), 'Start should return scoped impersonation permissions.', started.body)
    expect(started.body?.audit?.requestId && started.body?.audit?.api?.includes('/api/admin/audit-events'), 'Start should return visible audit link metadata.', started.body)

    const token = started.body.token
    const sessionId = started.body.session.id
    const stored = await pool.query('SELECT token_hash, revoked_at FROM impersonation_sessions WHERE id = $1', [sessionId])
    expect(stored.rows.length === 1, 'Session should be stored.', stored.rows)
    expect(stored.rows[0].token_hash !== token, 'Raw impersonation token must not be stored.', stored.rows[0])
    expect(stored.rows[0].token_hash === tokenDigest(token), 'Stored token hash mismatch.', stored.rows[0])

    return { token, sessionId, requestId: started.body.audit.requestId }
}
