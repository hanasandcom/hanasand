import { useEffect } from 'react'
import type { WorkbenchState } from './useWorkbenchState'

export function useWorkspaceHydration(state: WorkbenchState, activeConversation: AIConversation | null) {
    const { hydrateShare, hydrateShareFile, hydrateShareRef, hydrateShareFileRef, shareContents, shareFileContents } = state
    useEffect(() => { hydrateShareRef.current = hydrateShare }, [hydrateShare, hydrateShareRef])
    useEffect(() => { hydrateShareFileRef.current = hydrateShareFile }, [hydrateShareFile, hydrateShareFileRef])
    useEffect(() => {
        if (!activeConversation?.shareIds?.length) return
        const timer = setTimeout(() => {
            for (const shareId of activeConversation.shareIds) {
                if (!shareContents[shareId]) void hydrateShareRef.current(shareId)
            }
        }, 0)
        return () => clearTimeout(timer)
    }, [activeConversation, hydrateShareRef, shareContents])
    useEffect(() => {
        const selectedPath = typeof activeConversation?.workspaceMeta?.selectedFilePath === 'string'
            ? activeConversation.workspaceMeta.selectedFilePath
            : null
        const workspaceId = activeConversation?.workspaceId
        if (!workspaceId || !selectedPath) return
        const key = `${workspaceId}:${selectedPath}`
        const timer = setTimeout(() => {
            if (!shareFileContents[key]) void hydrateShareFileRef.current(workspaceId, selectedPath)
        }, 0)
        return () => clearTimeout(timer)
    }, [activeConversation, hydrateShareFileRef, shareFileContents])
}
