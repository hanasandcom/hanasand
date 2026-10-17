import { expect } from './api.mjs'

export async function checkRejectedStarts(context, api, { adminToken, nonAdminToken }) {
    const { adminId, targetId, inactiveTargetId, nonAdminId, suffix } = context
    const cases = [
        { path: '/impersonation/start', token: adminToken, actor: adminId, target: `missing_${suffix}`, status: 404, label: 'Missing target should be rejected.' },
        { path: '/impersonation/start', token: adminToken, actor: adminId, target: inactiveTargetId, status: 404, label: 'Inactive target should be rejected.' },
        { path: '/impersonation/start', token: adminToken, actor: adminId, target: adminId, status: 400, label: 'Self impersonation should be rejected.' },
        { path: '/impersonation/start', token: nonAdminToken, actor: nonAdminId, target: targetId, status: 403, label: 'Non-admin start should be rejected.', reason: 'non admin regression attempt' },
    ]

    for (const scenario of cases) {
        const result = await api.request(scenario.path, {
            method: 'POST',
            headers: api.authHeaders(scenario.actor, scenario.token),
            body: JSON.stringify({ target_id: scenario.target, ...(scenario.reason ? { reason: scenario.reason } : {}) }),
        })
        expect(result.response.status === scenario.status, scenario.label, result.body)
    }

    const missingReason = await api.request('/impersonation/start', {
        method: 'POST',
        headers: api.authHeaders(adminId, adminToken),
        body: JSON.stringify({ target_id: targetId }),
    })
    expect(missingReason.response.status === 400, 'Admin start should require a reason.', missingReason.body)
    expect(String(missingReason.body?.error || '').includes('at least 10 characters'), 'Missing reason error should explain requirement.', missingReason.body)

    const legacyHeader = await api.request(`/user/full/${targetId}`, {
        headers: api.authHeaders(adminId, adminToken, { 'x-impersonate-id': targetId }),
    })
    expect(legacyHeader.response.status !== 200, 'Legacy target header should not impersonate.', legacyHeader.body)
}
