'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, FolderKanban, LoaderCircle, PanelRight, PanelRightOpen, Sparkles } from 'lucide-react'
import conversationTitle from '@/utils/ai/conversationTitle'

type ChatHeaderProps = {
    conversation: AIConversation | null
    clients: GPT_Client[]
    isConnected: boolean
    isThinking: boolean
    hasReadyModel: boolean
    showArtifacts: boolean
    latestArtifacts: AIArtifact[]
    provider: 'hanasand' | 'chatgpt'
    canUseChatGPT: boolean
    onProviderChange: (value: 'hanasand' | 'chatgpt') => void
    showWorkspaceDetails: boolean
    workspaceDetailsOpen: boolean
    onToggleWorkspaceDetails: () => void
    onToggleArtifacts: () => void
    onModelStrategyChange: (strategy: 'auto' | 'pinned') => void
    onPreferredModelChange: (name: string | null) => void
}

export function ChatHeader({ conversation, clients, isConnected, isThinking, hasReadyModel, provider, canUseChatGPT, onProviderChange, showWorkspaceDetails, workspaceDetailsOpen, onToggleWorkspaceDetails, showArtifacts, latestArtifacts, onToggleArtifacts, onModelStrategyChange, onPreferredModelChange }: ChatHeaderProps) {
    const [modelMenuOpen, setModelMenuOpen] = useState(false)
    const selectedName = conversation?.preferredModel || conversation?.activeModel
    const selectedClient = clients.find(client => client.name === selectedName) || clients[0] || null
    const modelStatus = selectedClient ? 'Review ready' : 'Review paused'

    return <div className='relative z-10 w-full max-w-full border-b border-ui-border bg-ui-panel px-4 py-4 sm:px-7 sm:py-5'>
        <div className='flex min-w-0 flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4'>
            <div className='min-w-0'>
                {provider === 'chatgpt' ? null : <h1 className='truncate text-base font-semibold tracking-normal text-ui-text'>{conversationTitle(conversation?.title)}</h1>}
                <div className={`relative inline-block ${provider === 'chatgpt' ? '' : 'mt-1'}`}>
                    <button type='button' onClick={() => setModelMenuOpen(previous => !previous)} disabled={!clients.length && !canUseChatGPT} className='inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-md text-left text-sm font-semibold text-ui-primary transition-colors hover:text-ui-primary/80 disabled:cursor-not-allowed disabled:text-ui-muted sm:px-1' title={provider === 'chatgpt' ? 'ChatGPT' : modelStatus}>
                        <span className='truncate'>{provider === 'chatgpt' ? 'ChatGPT' : isConnected ? modelStatus : 'Review paused'}</span>
                        {clients.length || canUseChatGPT ? <ChevronDown className='h-3.5 w-3.5 shrink-0' /> : null}
                    </button>
                    {modelMenuOpen && (clients.length || canUseChatGPT) ? <div className='absolute left-0 top-full z-30 mt-2 w-[min(26rem,calc(100vw-3rem))] overflow-hidden rounded-lg border border-ui-border bg-ui-panel p-1 shadow-lg'>
                        {canUseChatGPT ? <>
                            <button type='button' onClick={() => { onProviderChange('hanasand'); setModelMenuOpen(false) }} className={`block w-full rounded-md px-3 py-2.5 text-left text-sm transition-colors ${provider === 'hanasand' ? 'bg-ui-primary/10 font-medium text-ui-primary' : 'text-ui-muted hover:bg-ui-raised hover:text-ui-text'}`}>Hanasand GPT</button>
                            <button type='button' onClick={() => { onProviderChange('chatgpt'); setModelMenuOpen(false) }} className={`block w-full rounded-md px-3 py-2.5 text-left text-sm transition-colors ${provider === 'chatgpt' ? 'bg-ui-primary/10 font-medium text-ui-primary' : 'text-ui-muted hover:bg-ui-raised hover:text-ui-text'}`}>ChatGPT</button>
                            {provider === 'hanasand' && clients.length ? <div className='my-1 border-t border-ui-border' /> : null}
                        </> : null}
                        {provider === 'hanasand' ? clients.map(client => <button key={client.name} type='button' onClick={() => { onProviderChange('hanasand'); onModelStrategyChange('pinned'); onPreferredModelChange(client.name); setModelMenuOpen(false) }} className={`block w-full rounded-md px-3 py-2.5 text-left transition-colors ${client.name === selectedClient?.name ? 'bg-ui-primary/10 text-ui-primary' : 'text-ui-muted hover:bg-ui-raised hover:text-ui-text'}`}>
                            <span className='block truncate text-sm font-medium'>{modelLabel(client)}</span>
                            <span className='mt-0.5 block truncate text-xs text-ui-muted'>{client.name}</span>
                        </button>) : null}
                    </div> : null}
                </div>
            </div>
            <div className='flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:justify-end'>
                <Link href={conversation?.workspaceId ? `/s/${conversation.workspaceId}` : '/s'} className='grid h-9 w-9 place-items-center rounded-lg text-ui-muted transition-colors hover:bg-ui-raised hover:text-ui-text' aria-label='Open context'><FolderKanban className='h-4 w-4 shrink-0' /></Link>
                {showWorkspaceDetails ? <button type='button' onClick={onToggleWorkspaceDetails} aria-label={workspaceDetailsOpen ? 'Hide workspace details' : 'Show workspace details'} className={`grid h-9 w-9 place-items-center rounded-lg transition-colors ${workspaceDetailsOpen ? 'bg-ui-primary/10 text-ui-primary' : 'text-ui-muted hover:bg-ui-raised hover:text-ui-text'}`}><PanelRight className='h-4 w-4' /></button> : null}
                <div className={`inline-flex h-9 items-center gap-2 rounded-full px-3 text-xs ${isThinking ? 'bg-ui-primary/10 text-ui-primary' : 'text-ui-muted'}`}>
                    {isThinking ? <LoaderCircle className='h-3.5 w-3.5 animate-spin' /> : <Sparkles className='h-3.5 w-3.5' />}
                    {isThinking ? 'Working...' : hasReadyModel ? 'Ready' : 'Paused'}
                </div>
                {latestArtifacts.length ? <button type='button' onClick={onToggleArtifacts} className={`inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-semibold transition-colors ${showArtifacts ? 'bg-ui-primary/10 text-ui-primary' : 'text-ui-muted hover:bg-ui-raised hover:text-ui-text'}`}><PanelRightOpen className='h-3.5 w-3.5' />Artifacts</button> : null}
            </div>
        </div>
    </div>
}

function modelLabel(client: GPT_Client) {
    return client.displayName || client.modelId || client.profile || client.name
}
