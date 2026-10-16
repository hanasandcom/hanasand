import { afterAll, beforeEach, expect, mock, test } from 'bun:test'
import Fastify from 'fastify'

const deploymentRows: Array<Record<string, unknown>> = []
let recentDeployCount = 0
let activeDeployCount = 0
let vmExists = true
let vmAccessible = true
let repositorySourcePath = ''
let repositoryFiles: AIImportedRepoFile[] = []

mock.module('#db', () => ({
    default: async (sql: string, params: unknown[] = []) => {
        if (sql.includes('SELECT COUNT(*)::int AS count') && sql.includes('created_at > NOW()')) return { rows: [{ count: recentDeployCount }] }
        if (sql.includes('SELECT DISTINCT ON (conversation_id)')) return { rows: [{ count: activeDeployCount }] }
        if (sql.includes('FROM ai_imported_repositories AS repositories')) return { rows: [{
            id: 'repo-1', owner_id: 'owner-1', name: 'Sample App', full_name: 'owner/sample-app', branch: 'main',
            source_path: repositorySourcePath, stack_type: 'docker_compose', stack_reason: 'compose files found', files: repositoryFiles,
        }] }
        if (sql.includes('FROM vms')) return { rows: vmExists ? [{
            name: 'deploy-vm', owner: 'owner-1', created_by: 'owner-1', access_users: ['owner-1'], device_eth0_ipv4_address: '192.0.2.10',
        }] : [] }
        if (sql.includes('INSERT INTO ai_deployments')) {
            const row = {
                id: params[0], owner_id: params[1], conversation_id: params[2], repository_id: params[3],
                workspace_kind: params[4], workspace_id: params[5], vm_name: params[6], service_name: params[7],
                stack_type: params[8], access_policy: params[9], started_by: params[10], status: params[11],
                preview_url: params[12], healthcheck_url: params[13], events: JSON.parse(String(params[14])),
                failure_reason: params[15], completed_at: params[16], created_at: '2026-10-15T12:00:00.000Z', updated_at: '2026-10-15T12:00:00.000Z',
            }
            deploymentRows.push(row)
            return { rows: [row] }
        }
        return { rows: [] }
    },
}))
mock.module('#constants', () => ({ default: { internal_api: 'http://internal.test', vm_api_token: 'bridge-token' } }))
mock.module('#utils/vms/access.ts', () => ({ hasVmAccess: async () => vmAccessible }))
mock.module('#utils/auth/organizationPageAccess.ts', () => ({ default: async () => ({ valid: false }) }))
mock.module('#utils/vms/agentTargetQuery.ts', () => ({ agentTargetSelect: 'SELECT v.name FROM vms v' }))
mock.module('#utils/ai/repoCredentials.ts', () => ({ getRepoCredential: async () => null }))
mock.module('../src/handlers/ai/shared.ts', () => ({
    requireAiUser: async () => 'collaborator-1',
    getConversationForUser: async () => ({
        id: 'conversation-1', owner_id: 'owner-1', title: 'Sample App', workspace_kind: 'repo', workspace_id: 'repo-1', workspace_meta: {},
    }),
}))
mock.module('#utils/ai/stack.ts', () => ({ detectRepositoryStack: () => ({ stackType: 'unknown', reason: 'unused fallback' }) }))
mock.module('#utils/ai/usage.ts', () => ({ recordAiUsageEvent: async () => {} }))
mock.module('#utils/ai/preview.ts', () => ({ buildAiPreviewUrl: (id: string) => `https://preview.example/${id}` }))

const { postAiDeployment } = await import('../src/handlers/ai/deployments.ts')
const app = Fastify()
app.post('/ai/deployments', postAiDeployment)
const originalFetch = globalThis.fetch

beforeEach(() => {
    deploymentRows.length = 0
    recentDeployCount = 0
    activeDeployCount = 0
    vmExists = true
    vmAccessible = true
    repositorySourcePath = ''
    repositoryFiles = []
})
afterAll(async () => {
    globalThis.fetch = originalFetch
    await app.close()
})

const startDeployment = () => app.inject({
    method: 'POST',
    url: '/ai/deployments',
    payload: { conversationId: 'conversation-1', vmName: 'deploy-vm' },
})

test('deploy bridge and health check retry transient responses and persist ordered lifecycle events', async () => {
    repositoryFiles = [
        { path: '.env.example', content: 'API_TOKEN=placeholder-value\nPORT=3000' },
        { path: 'src/config.ts', content: 'process.env.API_TOKEN; import.meta.env.PUBLIC_URL' },
    ]
    const calls: string[] = []
    globalThis.fetch = async (input) => {
        const url = String(input)
        calls.push(url)
        if (url.endsWith('/deploy')) {
            return calls.filter(value => value.endsWith('/deploy')).length === 1
                ? Response.json({ failureReason: 'temporarily busy' }, { status: 503 })
                : Response.json({ ok: true, events: [{ stage: 'build', message: 'Image built.' }] })
        }
        return calls.filter(value => value.endsWith('/request')).length === 1
            ? new Response('busy', { status: 429 })
            : new Response('healthy', { status: 200 })
    }

    const response = await startDeployment()
    const body = response.json()

    expect(response.statusCode).toBe(201)
    expect(body.deployment.status).toBe('running')
    expect(body.deployment).toMatchObject({
        ownerId: 'collaborator-1',
        conversationId: 'conversation-1',
        previewUrl: expect.stringMatching(/^https:\/\/preview\.example\/.+/),
    })
    expect(body.quota).toMatchObject({
        used: 0,
        limit: 5,
        remaining: 5,
        windowMinutes: 15,
        activeRunning: 0,
        maxRunning: 2,
        runningRemaining: 2,
        sharedAcrossCollaborators: true,
    })
    expect(calls.filter(url => url.endsWith('/deploy'))).toHaveLength(2)
    expect(calls.filter(url => url.endsWith('/request'))).toHaveLength(2)
    expect(body.deployment.events.map((event: { message: string }) => event.message)).toContain('Retrying remote deploy bridge after HTTP 503 (attempt 2/3).')
    expect(body.deployment.events.map((event: { message: string }) => event.message)).toContain('Retrying VM-local healthcheck after HTTP 429 (attempt 2/3).')
    expect(body.deployment.events.map((event: { message: string }) => event.message)).toContain('Image built.')
    expect(body.deployment.serviceName).toBe('sample-app')
    expect(body.deployment.events.map((event: { message: string }) => event.message)).toContain('Owned staging deployment profile: domain sample-app.staging.hanasand.com, automatic SSL after routing, VM deploy-vm, access owner only.')
    expect(body.deployment.events.map((event: { message: string }) => event.message)).toContain('Deploy checklist: 2 environment placeholders detected (API_TOKEN, PUBLIC_URL); values are never echoed.')
    expect(JSON.stringify(body.deployment.events)).not.toContain('placeholder-value')
    expect(body.deployment.events.at(-1).message).toBe('Healthcheck passed with HTTP 200.')
})

test('final bridge failure remains a persisted blocked deployment without a health-check request', async () => {
    const calls: string[] = []
    globalThis.fetch = async (input) => {
        calls.push(String(input))
        return Response.json({ failureReason: 'bridge unavailable' }, { status: 503 })
    }

    const response = await startDeployment()
    const body = response.json()

    expect(response.statusCode).toBe(202)
    expect(body.deployment.status).toBe('blocked')
    expect(body.deployment.failureReason).toContain('bridge unavailable')
    expect(calls.filter(url => url.endsWith('/deploy'))).toHaveLength(3)
    expect(calls.some(url => url.endsWith('/request'))).toBe(false)
    expect(deploymentRows).toHaveLength(1)
})

test('repository subfolder deployment stays blocked with actionable folder detail', async () => {
    let bridgeCalls = 0
    repositorySourcePath = 'apps/web'
    globalThis.fetch = async () => {
        bridgeCalls++
        return Response.json({ ok: true })
    }

    const response = await startDeployment()
    const body = response.json()
    const blockedEvent = body.deployment.events.find((event: { stage: string }) => event.stage === 'blocked')

    expect(response.statusCode).toBe(202)
    expect(body.deployment.status).toBe('blocked')
    expect(body.deployment.failureReason).toContain('Re-import the repository from its root, then deploy again.')
    expect(body.deployment.failureReason).toContain('Subfolder: apps/web.')
    expect(blockedEvent?.message).toContain('subpath "apps/web"')
    expect(bridgeCalls).toBe(0)
})

test('active deployment limit blocks new work before bridge calls or persistence', async () => {
    let bridgeCalls = 0
    globalThis.fetch = async () => {
        bridgeCalls++
        return Response.json({ ok: true })
    }
    activeDeployCount = 2

    const response = await startDeployment()
    const body = response.json()

    expect(response.statusCode).toBe(429)
    expect(body.quota).toMatchObject({ activeRunning: 2, maxRunning: 2, runningRemaining: 0 })
    expect(bridgeCalls).toBe(0)
    expect(deploymentRows).toHaveLength(0)
})

test('quota and VM access checks still stop deployment before contacting the bridge', async () => {
    let bridgeCalls = 0
    globalThis.fetch = async () => {
        bridgeCalls++
        return Response.json({ ok: true })
    }
    recentDeployCount = 5
    const quotaResponse = await startDeployment()
    expect(quotaResponse.statusCode).toBe(429)

    recentDeployCount = 0
    vmAccessible = false
    const deniedResponse = await startDeployment()
    expect(deniedResponse.statusCode).toBe(403)
    expect(bridgeCalls).toBe(0)
    expect(deploymentRows).toHaveLength(0)
})
