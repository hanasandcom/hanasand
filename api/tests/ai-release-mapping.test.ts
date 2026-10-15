import { expect, mock, test } from 'bun:test'

mock.module('#db', () => ({ default: async () => ({ rows: [] }) }))
mock.module('../src/handlers/ai/shared.ts', () => ({ requireAiUser: async () => 'owner-1' }))
mock.module('#utils/ai/usage.ts', () => ({ recordAiUsageEvent: async () => {} }))
mock.module('#utils/ai/preview.ts', () => ({ buildAiPreviewUrl: (id: string) => `https://preview.example/${id}` }))

const { toRelease } = await import('../src/handlers/ai/releases.ts')
const { toReleaseBase } = await import('../src/handlers/ai/releaseShared.ts')

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
