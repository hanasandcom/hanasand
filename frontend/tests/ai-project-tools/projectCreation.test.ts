// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { resolveAssistantToolCalls } from '../../src/components/ai/workbench/toolTags'
import { runWorkspaceTool } from '../../src/components/ai/workbench/workspaceToolActions'

function userMessage(content: string): AIConversationMessage[] {
    return [{ id: 'user-1', role: 'user', content, createdAt: '2026-01-01T00:00:00.000Z' }]
}

const projectFiles = [
    { path: 'package.json', content: JSON.stringify({ scripts: { build: 'next build', start: 'next start --hostname 0.0.0.0 --port 3000' }, dependencies: { next: '16.2.3', react: '19.2.5', 'react-dom': '19.2.5' } }) },
    { path: 'app/page.tsx', content: 'export default function Page() { return <main>Hello</main> }' },
]

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

test('creates the repository and runs a Next.js app in an Ubuntu VM', async () => {
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
        scaffoldStarter: async (...args) => {
            scaffoldCalls.push(args)
            return { files: projectFiles }
        },
        runTerminalCommand: async () => ({ ok: true, output: '' }),
        createVm: async (request) => {
            vmCalls.push(request)
            return { status: 201, message: 'Created VM demo-app.' }
        },
        setStatusNotice: (message) => statusCalls.push(message),
        getProjectStatus: async () => ({ status: 'running' }),
        getProjectPreview: async () => 'port-demo-app.hanasand.com',
    })

    expect(result?.ok).toBe(true)
    expect(scaffoldCalls).toEqual([['nextjs_docker', 'Demo App', null, undefined]])
    expect(vmCalls).toEqual([{
        name: 'demo-app',
        os: 'ubuntu-24.04',
        resources: { cpu: '2', memory: '4GiB', disk: '20GiB' },
        services: ['nodejs'],
        project_files: projectFiles,
    }])
    expect(statusCalls).toEqual(['Creating demo-app, installing dependencies, building the app, and starting the preview...'])
    expect(result?.message).toContain('confirmed the app responds on the VM')
    expect(result?.message).toContain('https://port-demo-app.hanasand.com')
})

test('does not report a pre-existing VM as newly provisioned', async () => {
    const result = await runWorkspaceTool({
        id: 'conversation-1', ownerId: 'user-1', title: 'Demo App', preferredModel: null, activeModel: null,
        modelStrategy: 'auto', workspaceId: null, workspaceKind: null, shareIds: [], workspaceMeta: {},
        messages: [], collaboration: { role: 'owner', canInvite: true, seatLimit: 1, seatCount: 1, remainingSeats: 0, collaborators: [] },
        metrics: {} as GPT_ModelMetrics, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    }, { action: 'create_project' }, {
        hydrateShare: async () => null,
        setShareContents: (() => {}) as React.Dispatch<React.SetStateAction<Record<string, string>>>,
        scaffoldStarter: async () => ({ files: projectFiles }),
        runTerminalCommand: async () => ({ ok: true, output: '' }),
        createVm: async () => ({ status: 409, message: 'VM already exists.' }),
        setStatusNotice: () => {},
    })

    expect(result?.ok).toBe(false)
    expect(result?.message).toContain('already exists')
    expect(result?.message).toContain('No new VM setup was started')
})

test('reports unsupported terminal commands as failed checks', async () => {
    const result = await runWorkspaceTool({
        id: 'conversation-1', ownerId: 'user-1', title: 'Demo App', preferredModel: null, activeModel: null,
        modelStrategy: 'auto', workspaceId: 'workspace-1', workspaceKind: 'share', shareIds: ['workspace-1'], workspaceMeta: {},
        messages: [], collaboration: { role: 'owner', canInvite: true, seatLimit: 1, seatCount: 1, remainingSeats: 0, collaborators: [] },
        metrics: {} as GPT_ModelMetrics, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    }, { action: 'run_terminal_command', command: 'npm install' }, {
        hydrateShare: async () => null,
        setShareContents: (() => {}) as React.Dispatch<React.SetStateAction<Record<string, string>>>,
        scaffoldStarter: async () => ({ files: projectFiles }),
        runTerminalCommand: async () => ({ ok: true, output: 'npm: command is not available in this browser terminal' }),
        createVm: async () => ({ status: 201, message: 'Created VM demo-app.' }),
        setStatusNotice: () => {},
    })

    expect(result?.ok).toBe(false)
    expect(result?.message).toContain('Could not run npm install')
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
        scaffoldStarter: async () => ({ files: projectFiles }),
        runTerminalCommand: async () => ({ ok: true, output: '' }),
        createVm: async () => ({ status: 503, message: 'VM service unavailable.' }),
        setStatusNotice: () => {},
    })

    expect(result?.ok).toBe(false)
    expect(result?.message).toContain('repository')
    expect(result?.message).toContain('VM service unavailable.')
})
