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
    landing?: boolean
    readOnly?: boolean
    onComposerChange: (value: string) => void
    onModelStrategyChange: (value: 'auto' | 'pinned') => void
    onPreferredModelChange: (value: string | null) => void
    onSend: () => void
}

const EMPTY_CHAT_TOOLTIPS = [
    'Attach the relevant context, then ask for a focused review, code change, or release check.',
    'Start from a bug, repo, screenshot, or customer note and keep the important context visible.',
    'Ask for a plan, implementation pass, browser check, or customer-ready summary.',
]

export default function ChatPane({ activeConversation, clients, composer, isConnected, isAuthenticated, readOnly = false, onModelStrategyChange, onPreferredModelChange, onComposerChange, onSend }: ChatPaneProps) {
    const scrollRef = useRef<HTMLDivElement | null>(null)
    const [showArtifacts, setShowArtifacts] = useState(false)
    const [previewArtifact, setPreviewArtifact] = useState<AIArtifact | null>(null)
    const emptyTooltip = useMemo(() => pickTooltip(EMPTY_CHAT_TOOLTIPS) || EMPTY_CHAT_TOOLTIPS[0], [])
    const isThinking = Boolean(activeConversation?.messages.at(-1)?.pending)
        || activeConversation?.metrics?.status === 'preparing'
        || activeConversation?.metrics?.status === 'generating'
    const awaitingResponse = Boolean(activeConversation?.messages.at(-1)?.pending)
    const hasReadyModel = isConnected && clients.length > 0
    const unavailableModelReason = isAuthenticated
        ? 'Review is paused. You can still open context, attach files, and continue from this page.'
        : 'Review is paused. Sign in to continue, or open shared context first.'
    const blockedReason = readOnly
        ? 'Reviewer mode: you can inspect this workspace but cannot send prompts.'
        : awaitingResponse
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
            <ChatHeader conversation={activeConversation} clients={clients} isConnected={isConnected} isThinking={isThinking} hasReadyModel={hasReadyModel} showArtifacts={showArtifacts} latestArtifacts={latestArtifacts} onToggleArtifacts={() => setShowArtifacts(previous => !previous)} onModelStrategyChange={onModelStrategyChange} onPreferredModelChange={onPreferredModelChange} />
            <div className={`grid min-h-0 w-full max-w-full flex-1 ${showArtifacts ? 'grid-cols-1 xl:grid-cols-[minmax(0,1fr)_22rem]' : 'grid-cols-1'}`}>
                <ChatTranscript conversation={activeConversation} scrollRef={scrollRef} emptyTooltip={emptyTooltip} hasReadyModel={hasReadyModel} isAuthenticated={isAuthenticated} onPreview={setPreviewArtifact} />
                {showArtifacts ? <ArtifactSidebar groups={groupedArtifacts} onPreview={setPreviewArtifact} /> : null}
            </div>
            <ChatComposer value={composer} blockedReason={blockedReason} awaitingResponse={awaitingResponse} readOnly={readOnly} onChange={onComposerChange} onSend={onSend} />
        </section>
        <ArtifactPreviewOverlay artifact={previewArtifact} onClose={() => setPreviewArtifact(null)} />
    </Fragment>
}

function pickTooltip(tooltips: unknown[]) {
    const candidates = tooltips.map(item => {
        if (typeof item === 'string') return { text: item, weight: 1 }
        if (item && typeof item === 'object' && 'text' in item && typeof item.text === 'string') {
            return { text: item.text, weight: 'weight' in item && typeof item.weight === 'number' && Number.isFinite(item.weight) ? item.weight : 1 }
        }
        if (item && typeof item === 'object' && 'message' in item && typeof item.message === 'string') return { text: item.message, weight: 1 }
        return { text: '', weight: 1 }
    }).map(item => ({ ...item, text: item.text.trim(), weight: Math.max(0.1, item.weight) })).filter(item => item.text)
    if (!candidates.length) return ''
    const total = candidates.reduce((sum, item) => sum + item.weight, 0)
    let cursor = Math.random() * total
    for (const candidate of candidates) {
        cursor -= candidate.weight
        if (cursor <= 0) return candidate.text
    }
    return candidates[0]?.text || ''
}
