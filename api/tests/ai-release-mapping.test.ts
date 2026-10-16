import { expect, mock, test } from 'bun:test'

let supportBundleRow: Record<string, unknown> | null = null
mock.module('#db', () => ({ default: async () => ({ rows: supportBundleRow ? [supportBundleRow] : [] }) }))
mock.module('../src/handlers/ai/shared.ts', () => ({ requireAiUser: async () => 'owner-1' }))
mock.module('#utils/ai/usage.ts', () => ({ recordAiUsageEvent: async () => {} }))
mock.module('#utils/ai/preview.ts', () => ({ buildAiPreviewUrl: (id: string) => `https://preview.example/${id}` }))

const { toRelease, toReleaseBase } = await import('../src/handlers/ai/releaseShared.ts')
const { getAiReleaseSupportBundle } = await import('../src/handlers/ai/releases.ts')

const row: ReleaseRow = {
    id: 'release-1',
    owner_id: 'owner-1',
    conversation_id: 'conversation-1',
    deployment_id: 'deployment-1',
    vm_name: 'preview-vm',
    stack_type: 'nextjs_docker',
    access_policy: 'owner_only',
    status: 'current',
    preview_url: 'https://legacy.example/',
    created_by: 'owner-1',
    created_at: '2026-10-15T12:00:00.000Z',
    updated_at: '2026-10-16T12:00:00.000Z',
    notes: null,
}

test('workspace release mapping keeps base fields while endpoint mapping adds trust', () => {
    const workspaceRelease = toReleaseBase(row)
    const endpointRelease = toRelease(row)

    expect(workspaceRelease).toEqual({
        id: 'release-1',
        ownerId: 'owner-1',
        conversationId: 'conversation-1',
        deploymentId: 'deployment-1',
        vmName: 'preview-vm',
        stackType: 'nextjs_docker',
        accessPolicy: 'owner_only',
        status: 'current',
        previewUrl: 'https://preview.example/deployment-1',
        createdBy: 'owner-1',
        createdAt: '2026-10-15T12:00:00.000Z',
        updatedAt: '2026-10-16T12:00:00.000Z',
        notes: null,
    })
    expect(workspaceRelease).not.toHaveProperty('trust')
    expect(toReleaseBase({ ...row, deployment_id: null }).previewUrl).toBe('https://legacy.example/')
    expect(endpointRelease).toMatchObject({ ...workspaceRelease, trust: expect.any(Object) })
    expect(Object.fromEntries(Object.entries(endpointRelease).filter(([key]) => key !== 'trust'))).toEqual(workspaceRelease)
})

test('release trust keeps unique request IDs from deployment events', () => {
    const release = toRelease({
        ...row,
        events: [
            { stage: 'build', message: 'request_id: req-123456', timestamp: row.created_at },
            { stage: 'run', message: 'X-Request-ID=req-123456', timestamp: row.updated_at },
        ],
    })

    expect(release.trust.supportBundle.requestIds).toEqual(['req-123456'])
})

test('support bundle uses the same release projection and keeps its bounded event list', async () => {
    const event = { stage: 'build' as const, message: 'request_id: req-123456', timestamp: row.created_at }
    supportBundleRow = {
        ...row,
        events: Array.from({ length: 31 }, (_, index) => ({ ...event, message: `event ${index} request_id: req-123456` })),
        failure_reason: null,
        healthcheck_url: 'http://127.0.0.1:3000/health',
        service_name: 'preview-vm',
        workspace_kind: 'repo',
        workspace_id: 'repo-1',
        repository_id: 'repo-1',
    }
    const reply = {
        statusCode: 200,
        status(code: number) { this.statusCode = code; return this },
        send(body: unknown) { return { statusCode: this.statusCode, body } },
    }

    try {
        const result = await getAiReleaseSupportBundle({ params: { id: row.id } } as never, reply as never) as {
            statusCode: number
            body: { release: AIRelease, bundle: { events: AIDeploymentEvent[], requestIds: string[] } }
        }

        expect(result.statusCode).toBe(200)
        expect(result.body.release.trust.supportBundle.requestIds).toEqual(['req-123456'])
        expect(result.body.bundle.requestIds).toEqual(['req-123456'])
        expect(result.body.bundle.events).toHaveLength(30)
        expect(result.body.bundle.events[0].message).toContain('event 1')
    } finally {
        supportBundleRow = null
    }
})
