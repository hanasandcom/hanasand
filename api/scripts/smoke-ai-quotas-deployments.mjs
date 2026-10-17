import { expect } from './smoke-ai-quotas-fixture.mjs'

export async function runDeploymentQuotaScenario({ pool, runId, conversationId, secondConversationId, repositoryId, vmName, request, authHeaders }) {
    await pool.query(`
        INSERT INTO ai_deployments (
            id, owner_id, conversation_id, repository_id, workspace_kind, workspace_id, vm_name, service_name,
            stack_type, access_policy, started_by, status, preview_url, healthcheck_url, events, failure_reason, completed_at
        )
        VALUES
        (
            $1, $2, $3, $4, 'repo', $4, $5, 'quota-app-a',
            'nextjs_docker', 'owner_only', $2, 'running', 'http://preview-a', 'http://127.0.0.1:3000/',
            '[]'::jsonb, NULL, NOW()
        ),
        (
            $6, $2, $7, $4, 'repo', $4, $5, 'quota-app-b',
            'nextjs_docker', 'owner_only', $2, 'healthchecking', 'http://preview-b', 'http://127.0.0.1:3001/',
            '[]'::jsonb, NULL, NOW()
        )
    `, [
        `deploy_running_${Date.now()}`,
        runId,
        conversationId,
        repositoryId,
        vmName,
        `deploy_checking_${Date.now()}`,
        secondConversationId,
    ])

    const quota = await request('/ai/deployments', { headers: authHeaders() })
    expect(quota.response.status === 200, 'Failed to fetch deployment quota.', quota.body)
    expect(quota.body?.quota?.activeRunning === 2, 'Active running deploy count did not match seeded data.', quota.body)
    expect(quota.body?.quota?.runningRemaining === 0, 'Running remaining count should be zero.', quota.body)
    expect(quota.body?.quota?.sharedAcrossCollaborators === true, 'Quota should be marked shared across collaborators.', quota.body)

    const blocked = await request('/ai/deployments', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ conversationId, vmName, port: 3000, healthPath: '/' }),
    })
    expect(blocked.response.status === 429, 'Concurrent live deploy limit should reject the request.', blocked.body)
    expect(typeof blocked.body?.error === 'string' && blocked.body.error.includes('Live deploy limit reached'), 'Blocked deploy should explain the live deploy limit.', blocked.body)
    expect(blocked.body?.quota?.activeRunning === 2, 'Blocked deploy response should include active running count.', blocked.body)

    return { quota, blocked }
}
