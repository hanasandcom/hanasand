import { updateShare } from '@/utils/share/put'
import postVM from '@/utils/vms/fetch/postVM'
import getVM from '@/utils/vms/fetch/getVM'
import { requestVmPublicServices } from '@/utils/vms/fetch/publicServices'
import { slugify } from './toolTags'
import type { AiToolCall } from './aiToolTypes'

type ToolResult = { ok: boolean, message: string, artifacts?: AIArtifact[] }

export async function runWorkspaceTool(
    conversation: AIConversation,
    toolCall: AiToolCall,
    dependencies: {
        hydrateShare: (shareId: string) => Promise<Share | null>
        setShareContents: React.Dispatch<React.SetStateAction<Record<string, string>>>
        scaffoldStarter: (template: 'nextjs_docker', projectName?: string | null, targetShareId?: string | null, projectFiles?: Array<{ path: string, content: string }>) => Promise<{ files: Array<{ path: string, content: string }> } | void>
        runTerminalCommand: (shareId: string, command: string, timeoutMs?: number) => Promise<{ ok: boolean, output: string }>
        createVm: typeof postVM
        setStatusNotice: (message: string) => void
        getProjectStatus?: (vmName: string) => Promise<{ status: string, reason?: string } | null>
        getProjectPreview?: (vmName: string) => Promise<string | null>
    }
): Promise<ToolResult | null> {
    const { hydrateShare, setShareContents, scaffoldStarter, runTerminalCommand, createVm, setStatusNotice } = dependencies
    if (toolCall.action === 'read_share') {
        const shareId = toolCall.shareId || conversation.workspaceId || conversation.shareIds[0]
        if (!shareId) return { ok: false, message: 'Tool failed: no repository file is attached to this conversation.' }
        const share = await hydrateShare(shareId)
        if (!share) return { ok: false, message: `Tool failed: unable to read repository file ${shareId}.` }
        return { ok: true, message: `Read repository file ${shareId}.\n\n${share.content.slice(0, 12000)}` }
    }
    if (toolCall.action === 'update_share') {
        const shareId = toolCall.shareId || conversation.workspaceId || conversation.shareIds[0]
        if (!shareId || !toolCall.content) return { ok: false, message: 'Tool failed: update_share requires a repository file and content.' }
        const updated = await updateShare(shareId, { content: toolCall.content, path: toolCall.path })
        if (!updated) return { ok: false, message: `Tool failed: unable to update repository file ${shareId}.` }
        setShareContents((prev) => ({ ...prev, [shareId]: updated.content }))
        return { ok: true, message: `Updated repository file ${shareId}${toolCall.path ? ` at ${toolCall.path}` : ''}.` }
    }
    if (toolCall.action === 'scaffold_nextjs_docker') {
        const projectName = toolCall.projectName || conversation.title || 'hanasand-next-docker'
        await scaffoldStarter('nextjs_docker', projectName, toolCall.shareId || conversation.workspaceId || null)
        const repositoryName = projectName.trim() || 'hanasand-next-docker'
        return { ok: true, message: `Created a Next.js + Docker repository for ${repositoryName}. It is attached and ready for follow-up edits.` }
    }
    if (toolCall.action === 'create_vm') {
        const vmName = slugify(toolCall.vmName || toolCall.projectName || conversation.title || 'hanasand-project')
        const result = await createVm({ name: vmName })
        return { ok: result.status < 400, message: result.message }
    }
    if (toolCall.action === 'create_project') {
        const projectName = toolCall.projectName || conversation.title || 'hanasand-project'
        const safeVmName = slugify(toolCall.vmName || projectName)
            .replace(/^[^a-z]+/, '')
            .slice(0, 36)
            .replace(/-+$/, '') || 'hanasand-project'
        const vmName = safeVmName.length === 1 ? `${safeVmName}-app` : safeVmName
        const scaffold = await scaffoldStarter('nextjs_docker', projectName, toolCall.shareId || conversation.workspaceId || null, toolCall.projectFiles)
        if (!scaffold?.files.length) {
            return { ok: false, message: `Could not create ${projectName}: the repository setup did not return project files, so no VM was started.` }
        }
        setStatusNotice(`Creating ${vmName}, installing dependencies, building the app, and starting the preview...`)
        const result = await createVm({
            name: vmName,
            os: 'ubuntu-24.04',
            resources: { cpu: '2', memory: '4GiB', disk: '20GiB' },
            services: ['nodejs'],
            project_files: scaffold.files,
        })
        if (result.status === 409) {
            return {
                ok: false,
                message: `Created the ${projectName} repository, but VM ${vmName} already exists. No new VM setup was started; choose another VM name or manage the existing VM.`,
            }
        }
        if (result.status >= 400) {
            return {
                ok: false,
                message: `Created the ${projectName} repository, but VM provisioning could not start: ${result.message}`,
            }
        }
        const getProjectStatus = dependencies.getProjectStatus || (async (name: string) => {
            const vms = await getVM(name)
            const vm = vms?.[0]
            return vm?.status ? { status: String(vm.status).toLowerCase(), reason: vm.status_reason } : null
        })
        const deadline = Date.now() + 180_000
        let state: { status: string, reason?: string } | null
        do {
            state = await getProjectStatus(vmName).catch(() => null)
            const normalized = state?.status.toLowerCase()
            if (normalized === 'running' || normalized === 'error' || normalized === 'offline') break
            if (Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 5000))
        } while (Date.now() < deadline)

        if (state?.status.toLowerCase() === 'running') {
            const preview = await (dependencies.getProjectPreview || (async (name: string) => {
                const result = await requestVmPublicServices(name, 'GET')
                return 'services' in result ? result.services.find((service) => service.port === 3000 && service.type === 'http')?.hostname || null : null
            }))(vmName).catch(() => null)
            return {
                ok: Boolean(preview),
                message: preview
                    ? `Created ${projectName}, installed its dependencies, built it, and confirmed the app responds on the VM. Preview: https://${preview}`
                    : `Created ${projectName} and confirmed the VM reports the app build and startup complete, but the public preview address could not be read. Check VM ${vmName}'s public services.`,
            }
        }
        if (state?.status.toLowerCase() === 'error') return { ok: false, message: `Created the ${projectName} repository, but VM ${vmName} setup failed: ${state.reason || 'check VM setup logs'}` }
        return { ok: false, message: `Created ${projectName} and started VM ${vmName}, but the build is still in progress. Latest status: ${state?.reason || state?.status || 'status unavailable'}.` }
    }
    if (toolCall.action === 'run_terminal_command') {
        const shareId = toolCall.shareId || conversation.workspaceId || conversation.shareIds[0]
        if (!shareId || !toolCall.command) return { ok: false, message: 'Tool failed: run_terminal_command requires a repository and command.' }
        const result = await runTerminalCommand(shareId, toolCall.command, toolCall.timeoutMs)
        const unsupportedCommand = /command is not available in this browser terminal/i.test(result.output)
        return {
            ok: result.ok && !unsupportedCommand,
            message: [
                unsupportedCommand ? `Could not run ${toolCall.command} in repository ${shareId}.` : `Ran terminal command in repository ${shareId}.`,
                `Command: ${toolCall.command}`,
                'Output:',
                result.output,
            ].join('\n\n'),
        }
    }
    return null
}
