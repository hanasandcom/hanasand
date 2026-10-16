import { useEffect } from 'react'
import { runNetworkTool } from './networkToolActions'
import { runWorkspaceTool } from './workspaceToolActions'
import type { WorkbenchState } from './useWorkbenchState'

export function useAssistantToolRunner(
    state: WorkbenchState,
    scaffoldStarter: (template: 'nextjs_docker', projectName?: string | null, targetShareId?: string | null) => Promise<void>,
    runTerminalCommand: (shareId: string, command: string, timeoutMs?: number) => Promise<{ ok: boolean, output: string }>
) {
    const { runToolCallRef, hydrateShareRef, setShareContents } = state
    useEffect(() => {
        runToolCallRef.current = async (conversation, toolCall) => {
            const networkResult = await runNetworkTool(toolCall)
            if (networkResult) return networkResult
            const workspaceResult = await runWorkspaceTool(conversation, toolCall, {
                hydrateShare: (shareId) => hydrateShareRef.current(shareId),
                setShareContents,
                scaffoldStarter,
                runTerminalCommand,
            })
            return workspaceResult || { ok: false, message: `Tool failed: unsupported action ${toolCall.action}.` }
        }
    }, [hydrateShareRef, runToolCallRef, scaffoldStarter, setShareContents, runTerminalCommand])
}
