'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, LoaderCircle, PanelLeft, PanelRight, PanelRightOpen } from 'lucide-react'
import conversationTitle from '@/utils/ai/conversationTitle'

type ChatHeaderProps = {
    conversation: AIConversation | null
    isThinking: boolean
    showArtifacts: boolean
    latestArtifacts: AIArtifact[]
    provider: 'hanasand' | 'chatgpt'
    canUseChatGPT: boolean
    onProviderChange: (value: 'hanasand' | 'chatgpt') => void
    showWorkspaceDetails: boolean
    workspaceDetailsOpen: boolean
    onToggleWorkspaceDetails: () => void
    onToggleMobileChats: () => void
    onToggleArtifacts: () => void
}

export function ChatHeader({ conversation, isThinking, provider, canUseChatGPT, onProviderChange, showWorkspaceDetails, workspaceDetailsOpen, onToggleWorkspaceDetails, onToggleMobileChats, showArtifacts, latestArtifacts, onToggleArtifacts }: ChatHeaderProps) {
    const [modelMenuOpen, setModelMenuOpen] = useState(false)
    const modelMenuRef = useRef<HTMLDivElement>(null)
    const modelName = provider === 'chatgpt' ? 'ChatGPT' : 'Hanasand GPT'

    useEffect(() => {
        if (!modelMenuOpen) return
        function closeWhenOutside(event: PointerEvent) {
            if (!modelMenuRef.current?.contains(event.target as Node)) setModelMenuOpen(false)
        }
        function closeOnEscape(event: KeyboardEvent) {
            if (event.key === 'Escape') setModelMenuOpen(false)
        }
        document.addEventListener('pointerdown', closeWhenOutside)
        document.addEventListener('keydown', closeOnEscape)
        return () => {
            document.removeEventListener('pointerdown', closeWhenOutside)
            document.removeEventListener('keydown', closeOnEscape)
        }
    }, [modelMenuOpen])

    return <div className='relative z-10 w-full max-w-full border-b border-ui-border/70 px-4 py-2 sm:px-7'>
        <div className='flex min-w-0 items-center justify-between gap-4'>
            <div className='flex min-w-0 items-center gap-2'>
                <button type='button' aria-label='Chats' title='Chats' onClick={onToggleMobileChats} className='grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ui-muted transition-colors hover:bg-ui-raised hover:text-ui-text md:hidden'><PanelLeft className='h-4 w-4' /></button>
                <div className='min-w-0'>
                    {conversation?.messages.length ? <h1 className='truncate text-sm font-medium text-ui-text'>{conversationTitle(conversation.title)}</h1> : null}
                    <div ref={modelMenuRef} className={`relative inline-block ${conversation?.messages.length ? 'mt-0.5' : ''}`} onMouseLeave={() => setModelMenuOpen(false)}>
                        {canUseChatGPT ? <button type='button' onClick={() => setModelMenuOpen(previous => !previous)} aria-expanded={modelMenuOpen} aria-controls='assistant-provider-options' className='inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-md text-left text-sm font-medium text-ui-muted transition-colors hover:text-ui-text' title={modelName}>
                            <span className='truncate'>{modelName}</span>
                            <ChevronDown className='h-3.5 w-3.5 shrink-0' />
                        </button> : <span className='inline-flex min-h-8 items-center text-sm font-medium text-ui-muted'>{modelName}</span>}
                        {modelMenuOpen && canUseChatGPT ? <div className='absolute left-0 top-full z-30 w-[min(16rem,calc(100vw-3rem))] pt-2'>
                            <div id='assistant-provider-options' role='group' aria-label='Choose assistant' className='overflow-hidden rounded-lg border border-ui-border bg-ui-panel p-1 shadow-lg'>
                                <button type='button' aria-pressed={provider === 'hanasand'} onClick={() => { onProviderChange('hanasand'); setModelMenuOpen(false) }} className={`block w-full rounded-md px-3 py-2.5 text-left text-sm transition-colors ${provider === 'hanasand' ? 'bg-ui-primary/10 font-medium text-ui-primary' : 'text-ui-muted hover:bg-ui-raised hover:text-ui-text'}`}>Hanasand GPT</button>
                                <button type='button' aria-pressed={provider === 'chatgpt'} onClick={() => { onProviderChange('chatgpt'); setModelMenuOpen(false) }} className={`block w-full rounded-md px-3 py-2.5 text-left text-sm transition-colors ${provider === 'chatgpt' ? 'bg-ui-primary/10 font-medium text-ui-primary' : 'text-ui-muted hover:bg-ui-raised hover:text-ui-text'}`}>ChatGPT</button>
                            </div>
                        </div> : null}
                    </div>
                </div>
            </div>
            <div className='flex shrink-0 items-center gap-1'>
                {showWorkspaceDetails ? <button type='button' onClick={onToggleWorkspaceDetails} aria-label={workspaceDetailsOpen ? 'Hide repository details' : 'Show repository details'} title={workspaceDetailsOpen ? 'Hide repository details' : 'Show repository details'} className={`grid h-9 w-9 place-items-center rounded-lg transition-colors ${workspaceDetailsOpen ? 'bg-ui-primary/10 text-ui-primary' : 'text-ui-muted hover:bg-ui-raised hover:text-ui-text'}`}><PanelRight className='h-4 w-4' /></button> : null}
                {isThinking ? <span role='status' aria-label='Working' title='Working' className='grid h-9 w-9 place-items-center text-ui-muted'><LoaderCircle className='h-4 w-4 animate-spin' /></span> : null}
                {latestArtifacts.length ? <button type='button' onClick={onToggleArtifacts} className={`inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-semibold transition-colors ${showArtifacts ? 'bg-ui-primary/10 text-ui-primary' : 'text-ui-muted hover:bg-ui-raised hover:text-ui-text'}`}><PanelRightOpen className='h-3.5 w-3.5' />Artifacts</button> : null}
            </div>
        </div>
    </div>
}
