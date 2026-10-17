import { expect } from './api.mjs'

export async function checkSessionAccess(context, api, adminToken, impersonationToken) {
    const { adminId, targetId } = context
    const viewed = await api.request(`/user/full/${targetId}`, {
        headers: api.authHeaders(adminId, adminToken, { 'x-impersonation-token': impersonationToken }),
    })
    expect(viewed.response.status === 200, 'Impersonated view should succeed.', viewed.body)
    expect(viewed.response.headers.get('x-impersonating-id') === targetId, 'Response should expose target header.', Object.fromEntries(viewed.response.headers.entries()))
    expect(viewed.response.headers.get('x-authenticated-id') === adminId, 'Response should expose actor header.', Object.fromEntries(viewed.response.headers.entries()))

    const blocked = await api.request('/auth/sessions/0', {
        method: 'DELETE',
        headers: api.authHeaders(adminId, adminToken, { 'x-impersonation-token': impersonationToken }),
        body: JSON.stringify({}),
    })
    expect(blocked.response.status === 403, 'Sensitive action should be blocked while impersonating.', blocked.body)
    expect(String(blocked.body?.error || '').includes('Return to own view'), 'Sensitive action should explain how to proceed.', blocked.body)
}
