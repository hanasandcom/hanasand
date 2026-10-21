'use client'

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { ArtifactPreviewOverlay, groupArtifacts } from './chat/chatArtifacts'
import { ArtifactSidebar } from './chat/artifactSidebar'
import { ChatComposer } from './chat/chatComposer'
import { ChatHeader } from './chat/chatHeader'
import { ChatTranscript } from './chat/chatTranscript'

type ChatPaneProps = {
    activeConversation: AIConversation | null
    clients: GPT_Client[]
    composer: string
    isConnected: boolean
    isAuthenticated: boolean
    participants: number
    readOnly?: boolean
    onComposerChange: (value: string) => void
    onModelStrategyChange: (value: 'auto' | 'pinned') => void
    onPreferredModelChange: (value: string | null) => void
    onSend: () => void
    provider: 'hanasand' | 'chatgpt'
    canUseChatGPT: boolean
    promptPriority: 'now' | 'next'
    promptFiles: FileList | null
    promptBusy: boolean
    promptError: string
    onProviderChange: (value: 'hanasand' | 'chatgpt') => void
    onPromptPriorityChange: (value: 'now' | 'next') => void
    onPromptFilesChange: (files: FileList | null) => void
    onRefreshPrompts: () => void
    onEditPrompt: (id: string) => void
    onDeletePrompt: (id: string) => void
    onMovePrompt: (id: string, direction: 'up' | 'down') => void
    showWorkspaceDetails: boolean
    workspaceDetailsOpen: boolean
    onToggleWorkspaceDetails: () => void
    onToggleMobileChats: () => void
}

export default function ChatPane({ activeConversation, clients, composer, isConnected, isAuthenticated, readOnly = false, provider, canUseChatGPT, promptPriority, promptFiles, promptBusy, promptError, showWorkspaceDetails, workspaceDetailsOpen, onToggleWorkspaceDetails, onToggleMobileChats, onProviderChange, onPromptPriorityChange, onPromptFilesChange, onRefreshPrompts, onEditPrompt, onDeletePrompt, onMovePrompt, onModelStrategyChange, onPreferredModelChange, onComposerChange, onSend }: ChatPaneProps) {
    const scrollRef = useRef<HTMLDivElement | null>(null)
    const [showArtifacts, setShowArtifacts] = useState(false)
    const [previewArtifact, setPreviewArtifact] = useState<AIArtifact | null>(null)
    const isThinking = provider === 'chatgpt'
        ? Boolean(activeConversation?.messages.some(message => message.pending))
        : Boolean(activeConversation?.messages.at(-1)?.pending)
            || activeConversation?.metrics?.status === 'preparing'
            || activeConversation?.metrics?.status === 'generating'
    const awaitingResponse = Boolean(activeConversation?.messages.at(-1)?.pending)
    const hasReadyModel = provider === 'chatgpt' || isConnected && clients.length > 0
    const unavailableModelReason = isAuthenticated
        ? 'Hanasand GPT is unavailable right now.'
        : 'Sign in to send a message.'
    const blockedReason = readOnly
        ? 'Reviewer mode: you can inspect this workspace but cannot send prompts.'
        : !activeConversation ? provider === 'chatgpt' ? 'Preparing conversation…' : 'Starting a chat…'
            : awaitingResponse && provider !== 'chatgpt'
                ? 'Waiting for the current agent turn to finish.'
                : !hasReadyModel ? unavailableModelReason : null
    const lastMessage = activeConversation?.messages.at(-1)
    const lastMessageKey = `${lastMessage?.id || 'empty'}:${lastMessage?.content.length || 0}:${lastMessage?.pending ? 'pending' : 'done'}`

    useEffect(() => {
        const container = scrollRef.current
        if (container) container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })
    }, [lastMessageKey])

    const latestArtifacts = activeConversation?.messages.flatMap(message =>
        Array.isArray(message.metadata?.artifacts) ? message.metadata.artifacts as AIArtifact[] : []
    ) || []
    const groupedArtifacts = useMemo(() => groupArtifacts(latestArtifacts), [latestArtifacts])

    return <Fragment>
        <section className='relative flex min-h-0 w-full max-w-full min-w-0 flex-1 flex-col overflow-hidden'>
            <ChatHeader conversation={activeConversation} clients={clients} isThinking={isThinking} provider={provider} canUseChatGPT={canUseChatGPT} onProviderChange={onProviderChange} showWorkspaceDetails={showWorkspaceDetails} workspaceDetailsOpen={workspaceDetailsOpen} onToggleWorkspaceDetails={onToggleWorkspaceDetails} onToggleMobileChats={onToggleMobileChats} showArtifacts={showArtifacts} latestArtifacts={latestArtifacts} onToggleArtifacts={() => setShowArtifacts(previous => !previous)} onModelStrategyChange={onModelStrategyChange} onPreferredModelChange={onPreferredModelChange} />
            <div className={`grid min-h-0 w-full max-w-full flex-1 ${showArtifacts ? 'grid-cols-1 xl:grid-cols-[minmax(0,1fr)_22rem]' : 'grid-cols-1'}`}>
                <ChatTranscript conversation={activeConversation} scrollRef={scrollRef} hasReadyModel={hasReadyModel} isAuthenticated={isAuthenticated} onEditPrompt={onEditPrompt} onDeletePrompt={onDeletePrompt} onMovePrompt={onMovePrompt} onPreview={setPreviewArtifact} />
                {showArtifacts ? <ArtifactSidebar groups={groupedArtifacts} onPreview={setPreviewArtifact} /> : null}
            </div>
            <ChatComposer value={composer} blockedReason={blockedReason} awaitingResponse={provider === 'chatgpt' ? false : awaitingResponse} readOnly={readOnly} provider={provider} promptPriority={promptPriority} promptFiles={promptFiles} promptBusy={promptBusy} promptError={promptError} onPromptPriorityChange={onPromptPriorityChange} onPromptFilesChange={onPromptFilesChange} onRefreshPrompts={onRefreshPrompts} onChange={onComposerChange} onSend={onSend} />
        </section>
        <ArtifactPreviewOverlay artifact={previewArtifact} onClose={() => setPreviewArtifact(null)} />
    </Fragment>
}
