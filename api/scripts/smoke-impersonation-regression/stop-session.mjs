import { expect } from './api.mjs'

export async function stopSession(context, api, adminToken, session) {
    const { adminId, targetId, pool } = context
    const stop = await api.request('/impersonation', {
        method: 'DELETE',
        headers: api.authHeaders(adminId, adminToken, { 'x-impersonation-token': session.token }),
    })
    expect(stop.response.status === 200, 'Stop should succeed.', stop.body)

    const revoked = await pool.query('SELECT revoked_at, revoked_by FROM impersonation_sessions WHERE id = $1', [session.sessionId])
    expect(Boolean(revoked.rows[0]?.revoked_at), 'Stop should revoke the session.', revoked.rows[0])
    expect(revoked.rows[0]?.revoked_by === adminId, 'Stop should record revoker.', revoked.rows[0])

    const reused = await api.request(`/user/full/${targetId}`, {
        headers: api.authHeaders(adminId, adminToken, { 'x-impersonation-token': session.token }),
    })
    expect(reused.response.status === 401, 'Revoked token should be rejected.', reused.body)
    expect(String(reused.body?.error || '').includes('expired'), 'Revoked token should explain expiration.', reused.body)
}
