import { updateShare } from '@/utils/share/put'
import postVM from '@/utils/vms/fetch/postVM'
import { slugify } from './toolTags'
import type { AiToolCall } from './aiToolTypes'

type ToolResult = { ok: boolean, message: string, artifacts?: AIArtifact[] }

export async function runWorkspaceTool(
    conversation: AIConversation,
    toolCall: AiToolCall,
    dependencies: {
        hydrateShare: (shareId: string) => Promise<Share | null>
        setShareContents: React.Dispatch<React.SetStateAction<Record<string, string>>>
        scaffoldStarter: (template: 'nextjs_docker', projectName?: string | null, targetShareId?: string | null) => Promise<void>
        runTerminalCommand: (shareId: string, command: string, timeoutMs?: number) => Promise<{ ok: boolean, output: string }>
        createVm: typeof postVM
        setStatusNotice: (message: string) => void
    }
): Promise<ToolResult | null> {
    const { hydrateShare, setShareContents, scaffoldStarter, runTerminalCommand, createVm, setStatusNotice } = dependencies
    if (toolCall.action === 'read_share') {
        const shareId = toolCall.shareId || conversation.workspaceId || conversation.shareIds[0]
        if (!shareId) return { ok: false, message: 'Tool failed: no share is attached to this conversation.' }
        const share = await hydrateShare(shareId)
        if (!share) return { ok: false, message: `Tool failed: unable to read share ${shareId}.` }
        return { ok: true, message: `Read share ${shareId}.\n\n${share.content.slice(0, 12000)}` }
    }
    if (toolCall.action === 'update_share') {
        const shareId = toolCall.shareId || conversation.workspaceId || conversation.shareIds[0]
        if (!shareId || !toolCall.content) return { ok: false, message: 'Tool failed: update_share requires a target share and content.' }
        const updated = await updateShare(shareId, { content: toolCall.content, path: toolCall.path })
        if (!updated) return { ok: false, message: `Tool failed: unable to update share ${shareId}.` }
        setShareContents((prev) => ({ ...prev, [shareId]: updated.content }))
        return { ok: true, message: `Updated share ${shareId}${toolCall.path ? ` at ${toolCall.path}` : ''}.` }
    }
    if (toolCall.action === 'scaffold_nextjs_docker') {
        const projectName = toolCall.projectName || conversation.title || 'hanasand-next-docker'
        await scaffoldStarter('nextjs_docker', projectName, toolCall.shareId || conversation.workspaceId || null)
        const workspaceName = projectName.trim() || 'hanasand-next-docker'
        return { ok: true, message: `Scaffolded a Next.js + Docker workspace for ${workspaceName}. The workspace is attached and ready for follow-up edits.` }
    }
    if (toolCall.action === 'create_vm') {
        const vmName = slugify(toolCall.vmName || toolCall.projectName || conversation.title || 'hanasand-project')
        const result = await createVm({ name: vmName })
        return { ok: result.status < 400 || result.status === 409, message: result.message }
    }
    if (toolCall.action === 'create_project') {
        const projectName = toolCall.projectName || conversation.title || 'hanasand-project'
        const vmName = slugify(toolCall.vmName || projectName)
        await scaffoldStarter('nextjs_docker', projectName, toolCall.shareId || conversation.workspaceId || null)
        setStatusNotice(`Provisioning ${vmName} with Node.js and Docker...`)
        const result = await createVm({
            name: vmName,
            os: 'ubuntu-24.04',
            resources: { cpu: '1', memory: '2GiB', disk: '10GiB' },
            services: ['nodejs', 'docker'],
        })
        if (result.status >= 400) {
            return {
                ok: false,
                message: `Created the ${projectName} workspace, but VM provisioning could not start: ${result.message}`,
            }
        }
        return {
            ok: true,
            message: `Created the ${projectName} workspace and requested VM ${vmName} with Node.js and Docker. VM setup is provisioning in the background; check its status before running the app.`,
        }
    }
    if (toolCall.action === 'run_terminal_command') {
        const shareId = toolCall.shareId || conversation.workspaceId || conversation.shareIds[0]
        if (!shareId || !toolCall.command) return { ok: false, message: 'Tool failed: run_terminal_command requires a target share and command.' }
        const result = await runTerminalCommand(shareId, toolCall.command, toolCall.timeoutMs)
        return {
            ok: result.ok,
            message: [`Ran terminal command on share ${shareId}.`, `Command: ${toolCall.command}`, 'Output:', result.output].join('\n\n'),
        }
    }
    return null
}
