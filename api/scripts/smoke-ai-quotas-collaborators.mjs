import { expect } from './smoke-ai-quotas-fixture.mjs'

export async function runCollaboratorQuotaScenario({ request, authHeaders, collaboratorIds, conversationId }) {
    for (const collaboratorId of collaboratorIds.slice(0, 5)) {
        const invite = await request(`/ai/conversations/${conversationId}/collaborators`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ userId: collaboratorId, role: 'editor' }),
        })
        expect(invite.response.status === 201, 'Collaborator under the seat limit should be accepted.', invite.body)
    }

    const overSeatLimit = await request(`/ai/conversations/${conversationId}/collaborators`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ userId: collaboratorIds[5], role: 'reviewer' }),
    })
    expect(overSeatLimit.response.status === 429, 'Collaborator seat quota should reject the sixth invite.', overSeatLimit.body)
    expect(typeof overSeatLimit.body?.error === 'string' && overSeatLimit.body.error.includes('collaborator limit reached'), 'Seat quota error should explain the collaborator limit.', overSeatLimit.body)
    expect(overSeatLimit.body?.quota?.limit === 5, 'Seat quota response should expose the seat limit.', overSeatLimit.body)
    return overSeatLimit
}
