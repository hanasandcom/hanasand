// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { resolveAssistantToolCalls } from '../../src/components/ai/workbench/toolTags'
import { runWorkspaceTool } from '../../src/components/ai/workbench/workspaceToolActions'

function userMessage(content: string): AIConversationMessage[] {
    return [{ id: 'user-1', role: 'user', content, createdAt: '2026-01-01T00:00:00.000Z' }]
}

test('executes only direct Next.js app creation requests when the model omitted tool tags', () => {
    const conversation = (content: string, workspaceId: string | null = null, shareIds: string[] = []) => ({
        messages: userMessage(content), workspaceId, shareIds,
    })
    expect(resolveAssistantToolCalls('Here are instructions.', conversation('Build me a Next.js app')))
        .toEqual([{ action: 'create_project' }])
    expect(resolveAssistantToolCalls('Here are instructions.', conversation('How do I build a Next.js app?'))).toEqual([])
    expect(resolveAssistantToolCalls('Here are instructions.', conversation('What is Next.js?'))).toEqual([])
    expect(resolveAssistantToolCalls('Here are instructions.', conversation('Build a Python API'))).toEqual([])
    expect(resolveAssistantToolCalls('Here are instructions.', conversation('Build a Next.js app', 'existing-share'))).toEqual([])
    expect(resolveAssistantToolCalls('<hanasand-tool>{"action":"scaffold_nextjs_docker"}</hanasand-tool>', conversation('Build a Next.js app')))
        .toEqual([{ action: 'scaffold_nextjs_docker' }])
})

test('creates the workspace and requests an Ubuntu VM with Node.js and Docker', async () => {
    const scaffoldCalls: unknown[][] = []
    const vmCalls: unknown[] = []
    const statusCalls: string[] = []
    const result = await runWorkspaceTool({
        id: 'conversation-1', ownerId: 'user-1', title: 'Demo App', preferredModel: null, activeModel: null,
        modelStrategy: 'auto', workspaceId: null, workspaceKind: null, shareIds: [], workspaceMeta: {},
        messages: [], collaboration: { role: 'owner', canInvite: true, seatLimit: 1, seatCount: 1, remainingSeats: 0, collaborators: [] },
        metrics: {} as GPT_ModelMetrics, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    }, { action: 'create_project' }, {
        hydrateShare: async () => null,
        setShareContents: (() => {}) as React.Dispatch<React.SetStateAction<Record<string, string>>>,
        scaffoldStarter: async (...args) => { scaffoldCalls.push(args) },
        runTerminalCommand: async () => ({ ok: true, output: '' }),
        createVm: async (request) => {
            vmCalls.push(request)
            return { status: 201, message: 'Created VM demo-app.' }
        },
        setStatusNotice: (message) => statusCalls.push(message),
    })

    expect(result?.ok).toBe(true)
    expect(scaffoldCalls).toEqual([['nextjs_docker', 'Demo App', null]])
    expect(vmCalls).toEqual([{
        name: 'demo-app',
        os: 'ubuntu-24.04',
        resources: { cpu: '1', memory: '2GiB', disk: '10GiB' },
        services: ['nodejs', 'docker'],
    }])
    expect(statusCalls).toEqual(['Provisioning demo-app with Node.js and Docker...'])
    expect(result?.message).toContain('provisioning in the background')
})

test('reports VM failures without claiming the VM is ready', async () => {
    const result = await runWorkspaceTool({
        id: 'conversation-1', ownerId: 'user-1', title: 'Demo App', preferredModel: null, activeModel: null,
        modelStrategy: 'auto', workspaceId: null, workspaceKind: null, shareIds: [], workspaceMeta: {},
        messages: [], collaboration: { role: 'owner', canInvite: true, seatLimit: 1, seatCount: 1, remainingSeats: 0, collaborators: [] },
        metrics: {} as GPT_ModelMetrics, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    }, { action: 'create_project' }, {
        hydrateShare: async () => null,
        setShareContents: (() => {}) as React.Dispatch<React.SetStateAction<Record<string, string>>>,
        scaffoldStarter: async () => {},
        runTerminalCommand: async () => ({ ok: true, output: '' }),
        createVm: async () => ({ status: 503, message: 'VM service unavailable.' }),
        setStatusNotice: () => {},
    })

    expect(result?.ok).toBe(false)
    expect(result?.message).toContain('workspace')
    expect(result?.message).toContain('VM service unavailable.')
})
