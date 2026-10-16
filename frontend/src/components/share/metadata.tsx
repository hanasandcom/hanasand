'use client'

import { useEffect, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import GitPlugin from '@/components/share/gitPlugin'
import Info from '@/components/share/info'
import ShareChat from '@/components/share/shareChat'
import WorkspaceStatus from '@/components/share/workspaceStatus'
import type { TerminalCredentials } from '@/hooks/useTerminal'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import HideIfLittleSpace from '@/hooks/useHideIfLittleSpace'
import useMovable from '@/hooks/movable'
import Box from '../box/box'
import PhoneSimulator from './phoneSimulator'
import MetadataLauncher from './metadata/MetadataLauncher'
import MetadataPanelShell from './metadata/MetadataPanelShell'
import MetadataSidebar from './metadata/MetadataSidebar'
import SymbolPanel from './metadata/SymbolPanel'
import TerminalAccess from './metadata/TerminalAccess'
import type { MetadataPanel, VisibleMetadataPanel } from './metadata/panel'

type MetadataProps = {
    shareRouteId: string
    share: Share | null
    setShare: Dispatch<SetStateAction<Share | null>>
    isConnected: boolean
    showMetadata: boolean
    setShowMetadata: Dispatch<SetStateAction<boolean>>
    participants: number
    clickedWord: string | null
    setClickedWord: Dispatch<SetStateAction<string | null>>
    editingContent: string
    setDisplayLineNumbers: Dispatch<SetStateAction<boolean>>
    syntaxHighlighting: boolean
    setSyntaxHighlighting: Dispatch<SetStateAction<boolean>>
    box: boolean
    setBox: Dispatch<SetStateAction<boolean>>
    terminalStatus: string
    terminalCredentials: TerminalCredentials | null
    tree?: Tree | null
    setEditorPatch: Dispatch<SetStateAction<{ value: string; nonce: number } | null>>
    setTriggerTerminalChange: Dispatch<SetStateAction<boolean | 'close'>>
}

export default function Metadata(props: MetadataProps) {
    const {
        shareRouteId,
        share,
        setShare,
        isConnected,
        showMetadata,
        setShowMetadata,
        participants,
        clickedWord,
        setClickedWord,
        editingContent,
        setDisplayLineNumbers,
        setSyntaxHighlighting,
        syntaxHighlighting,
        box,
        setBox,
        terminalStatus,
        terminalCredentials,
        tree,
        setEditorPatch,
        setTriggerTerminalChange,
    } = props
    const { position, handleMouseDown } = useMovable({ side: 'right', setHide: setShowMetadata })
    const { condition: error, setCondition: setError } = useClearStateAfter()
    const [activePanel, setActivePanel] = useState<MetadataPanel>('workspace')
    const [isCompactViewport, setIsCompactViewport] = useState(false)
    const [localOpen, setLocalOpen] = useState(showMetadata)
    const metadataOpen = showMetadata || localOpen
    HideIfLittleSpace({ set: setShowMetadata, minWidth: 1180 })
    const { condition: didCopy, setCondition: setDidCopy } = useClearStateAfter({
        initialState: false,
        timeout: 350,
        onClear: () => setDidCopy(false),
    })

    useEffect(() => {
        const updateCompactViewport = () => setIsCompactViewport(window.innerWidth < 640)
        updateCompactViewport()
        window.addEventListener('resize', updateCompactViewport)
        return () => window.removeEventListener('resize', updateCompactViewport)
    }, [])

    useEffect(() => setLocalOpen(showMetadata), [showMetadata])

    function closeMetadata() {
        setLocalOpen(false)
        setShowMetadata(false)
    }

    function togglePanel(panel: VisibleMetadataPanel) {
        setActivePanel(previous => previous === panel ? null : panel)
    }

    if (!metadataOpen) {
        return (
            <MetadataLauncher
                isCompactViewport={isCompactViewport}
                isConnected={isConnected}
                participants={participants}
                position={position}
                onStartDrag={handleMouseDown}
                onOpen={() => {
                    setLocalOpen(true)
                    setShowMetadata(true)
                }}
            />
        )
    }

    return (
        <div className='flex h-full min-w-fit flex-row-reverse gap-2'>
            <MetadataSidebar
                shareRouteId={shareRouteId}
                share={share}
                activePanel={activePanel}
                onTogglePanel={togglePanel}
                onClose={closeMetadata}
                onOpenBox={() => {
                    setBox(true)
                    togglePanel('box')
                }}
                editingContent={editingContent}
                didCopy={didCopy}
                setDidCopy={setDidCopy}
                setError={setError}
                setDisplayLineNumbers={setDisplayLineNumbers}
                syntaxHighlighting={syntaxHighlighting}
                setSyntaxHighlighting={setSyntaxHighlighting}
            />
            {activePanel ? (
                <MetadataPanelShell
                    panel={activePanel}
                    error={error}
                    onHide={() => setActivePanel(null)}
                >
                    {activePanel === 'workspace' ? (
                        <WorkspaceStatus
                            shareRouteId={shareRouteId}
                            share={share}
                            tree={tree || null}
                            terminalStatus={terminalStatus}
                            setTriggerTerminalChange={setTriggerTerminalChange}
                        />
                    ) : null}
                    {activePanel === 'git' ? (
                        <GitPlugin shareRouteId={shareRouteId} share={share} />
                    ) : null}
                    {activePanel === 'phone' ? <PhoneSimulator share={share} open /> : null}
                    {activePanel === 'info' ? (
                        <Info share={share} isConnected={isConnected} participants={participants} />
                    ) : null}
                    {activePanel === 'terminal' ? (
                        <TerminalAccess
                            status={terminalStatus}
                            credentials={terminalCredentials}
                            setDidCopy={setDidCopy}
                        />
                    ) : null}
                    {activePanel === 'symbols' ? (
                        <SymbolPanel
                            tree={tree}
                            share={share}
                            clickedWord={clickedWord}
                            setClickedWord={setClickedWord}
                            editingContent={editingContent}
                        />
                    ) : null}
                    {activePanel === 'box' ? <Box box={box} setBox={setBox} share={share} /> : null}
                    {activePanel === 'chat' ? (
                        <ShareChat
                            share={share}
                            setShare={setShare}
                            tree={tree}
                            editingContent={editingContent}
                            setEditorPatch={setEditorPatch}
                        />
                    ) : null}
                </MetadataPanelShell>
            ) : null}
        </div>
    )
}
