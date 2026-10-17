import { expect } from './api.mjs'

export async function checkAuditEvents(context, api, adminToken, session) {
    const { adminId, targetId } = context
    const events = await api.request('/impersonation/events', { headers: api.authHeaders(adminId, adminToken) })
    expect(events.response.status === 200 && Array.isArray(events.body?.events), 'Admin should fetch audit events.', events.body)
    expect(events.body.events.some(event => event.session_id === session.sessionId && event.path === '/api/impersonation/start'), 'Start event should be audited.', events.body.events)
    expect(
        events.body.events.some(event => event.session_id === session.sessionId && ['/user/full/', '/api/user/full/'].some(prefix => event.path === `${prefix}${targetId}`)),
        'Impersonated route should be audited.',
        events.body.events
    )

    const filters = new URLSearchParams({
        q: targetId, actor: adminId, target: targetId, method: 'GET', path: '/user/full',
        session: session.sessionId.slice(0, 8), limit: '10',
    })
    const filtered = await api.request(`/impersonation/events?${filters}`, { headers: api.authHeaders(adminId, adminToken) })
    expect(filtered.response.status === 200 && Array.isArray(filtered.body?.events), 'Filtered audit fetch should succeed.', filtered.body)
    expect(filtered.body.events.length >= 1 && filtered.body.events.length <= 10, 'Filtered audit fetch should respect filters and limit.', filtered.body.events)
    expect(filtered.body.events.every(event => event.actor_id === adminId && event.target_id === targetId && event.method === 'GET' && event.session_id === session.sessionId), 'Filtered audit events should match requested filters.', filtered.body.events)

    const adminFilters = new URLSearchParams({
        actor: adminId, target: targetId, action: 'impersonation', severity: 'warning', source: 'admin',
        service: 'hanasand-api', request: session.requestId, entity: session.sessionId.slice(0, 8), outcome: 'success', limit: '25',
    })
    const adminAudit = await api.request(`/admin/audit-events?${adminFilters}`, { headers: api.authHeaders(adminId, adminToken) })
    expect(adminAudit.response.status === 200 && Array.isArray(adminAudit.body?.events), 'Admin audit feed should be available.', adminAudit.body)
    expect(adminAudit.body.events.some(event => event.action_type === 'impersonation.start' && event.reason === 'impersonation regression smoke' && event.entity_id === session.sessionId), 'Admin audit should include structured impersonation start.', adminAudit.body.events)
}
