'use client'

import Explorer from '@/components/share/tree/explorer'
import Deploy from '@/components/share/deploy'
import DisplayError from '@/components/share/search/displayError'
import Metadata from '@/components/share/metadata'
import RenderSite from '@/components/share/renderSite'
import Search from '@/components/share/search/search'
import Terminal from '@/components/share/terminal'
import ShareWorkspaceMain from './shareWorkspaceMain'
import { useShareWorkspaceState, type ClientPageProps } from './useShareWorkspaceState'

export default function ClientPage(props: ClientPageProps) {
    const state = useShareWorkspaceState(props)

    return (
        <div className='flex w-full h-full max-w-[100vw] min-w-0 overflow-hidden gap-1 p-1 md:gap-2 md:p-2'>
            <div className={state.chatOpen ? 'hidden md:contents' : 'contents'}>
                <Explorer
                    showExplorer={state.showExplorer}
                    setShowExplorer={state.setShowExplorer}
                    openFolders={props.openFolders}
                    tree={state.workspaceTree}
                    share={state.share}
                    setShare={state.setShare}
                    editingContent={state.editingContent}
                    setEditorPatch={state.setEditorPatch}
                    setError={state.setError}
                    setPageTree={state.setWorkspaceTree}
                    panelRequest={state.explorerPanelRequest}
                />
            </div>
            <ShareWorkspaceMain
                ui={{
                    chatOpen: state.chatOpen,
                    setChatOpen: state.setChatOpen,
                    hydrated: state.hydrated,
                    activeLabel: state.activeLabel,
                    openFiles: state.openFiles,
                    setOpenFiles: state.setOpenFiles,
                    isConnected: state.isConnected,
                    participants: state.participants,
                    saveState: state.saveState,
                    terminalStatus: state.terminalStatus,
                    workspaceCreated: state.workspaceCreated,
                }}
                presence={{
                    users: state.presenceUsers,
                    otherUsers: state.otherUsers,
                    editors: state.remoteEditors,
                    notice: state.remoteNotice,
                    conflict: state.conflict,
                    onDismissNotice: () => state.setRemoteNotice(null),
                    onUseRemote: () => {
                        if (!state.conflict) return
                        state.setEditingContent(state.conflict.remoteContent)
                        state.setEditorPatch({ value: state.conflict.remoteContent, nonce: Date.now() })
                        state.setConflict(null)
                        state.setRemoteNotice('Remote update applied.')
                    },
                    onKeepMine: () => {
                        state.setConflict(null)
                        state.setRemoteNotice('Kept your local version.')
                        state.setSaveState('saving')
                        state.setEditorPatch({ value: state.editingContent, nonce: Date.now() })
                    },
                }}
                code={{
                    id: state.share?.id || props.id,
                    setParticipants: state.setParticipants,
                    setIsConnected: state.setIsConnected,
                    editingContent: state.editingContent,
                    setEditingContent: state.setEditingContent,
                    share: state.share,
                    setShare: state.setShare,
                    setClickedWord: state.setClickedWord,
                    displayLineNumbers: state.displayLineNumbers,
                    syntaxHighlighting: state.syntaxHighlighting,
                    setError: state.setError,
                    setSaveState: state.setSaveState,
                    saveState: state.saveState,
                    setPresenceUsers: state.setPresenceUsers,
                    setSelfClientId: state.setSelfClientId,
                    setRemoteNotice: state.setRemoteNotice,
                    setConflict: state.setConflict,
                    connect: state.workspaceCreated,
                    editorPatch: state.editorPatch,
                }}
                chat={{
                    share: state.share,
                    setShare: state.setShare,
                    tree: state.workspaceTree,
                    editingContent: state.editingContent,
                    setEditorPatch: state.setEditorPatch,
                    mode: 'workspace',
                    previewUrl: state.previewEvidenceUrl,
                }}
            />
            {!state.chatOpen ? (
                <Metadata
                    shareRouteId={props.id} share={state.share} setShare={state.setShare} isConnected={state.isConnected}
                    showMetadata={state.showMetadata} setShowMetadata={state.setShowMetaData} participants={state.participants}
                    clickedWord={state.clickedWord} setClickedWord={state.setClickedWord} editingContent={state.editingContent}
                    setDisplayLineNumbers={state.setDisplayLineNumbers} syntaxHighlighting={state.syntaxHighlighting}
                    setSyntaxHighlighting={state.setSyntaxHighlighting} box={state.box} setBox={state.setBox}
                    terminalStatus={state.terminalStatus} terminalCredentials={state.terminalCredentials} tree={state.workspaceTree}
                    setEditorPatch={state.setEditorPatch} setTriggerTerminalChange={state.setTriggerTerminalChange}
                />
            ) : null}
            <Terminal
                share={state.share} open={state.terminalOpen} setOpen={state.setTerminalOpen}
                shareTerminalHeight={props.shareTerminalHeight} triggerChange={state.triggerTerminalChange}
                setTriggerChange={state.setTriggerTerminalChange} setTerminalStatus={state.setTerminalStatus}
                setTerminalCredentials={state.setTerminalCredentials}
            />
            <Deploy terminalOpen={state.terminalOpen} setTerminalOpen={state.setTerminalOpen} capability={state.runtimeCapability} />
            <RenderSite
                share={state.share} renderSite={state.renderSite} setRenderSite={state.setRenderSite}
                sharePageWidth={props.sharePageWidth} triggerChange={state.triggerSiteChange}
                setTriggerChange={state.setTriggerSiteChange} capability={state.runtimeCapability}
            />
            <Search
                setTriggerSiteChange={state.setTriggerSiteChange} setBox={state.setBox}
                setTriggerTerminalChange={state.setTriggerTerminalChange} setShowExplorer={state.setShowExplorer}
                setShowMetaData={state.setShowMetaData}
            />
            <DisplayError
                error={state.error} onRetry={state.retry} onDismiss={() => state.setError(null)}
            />
        </div>
    )
}
