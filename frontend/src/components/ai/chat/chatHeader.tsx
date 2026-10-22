'use client'

import { LoaderCircle, PanelLeft, PanelRight, PanelRightOpen } from 'lucide-react'
import conversationTitle from '@/utils/ai/conversationTitle'

type ChatHeaderProps = {
    conversation: AIConversation | null
    isThinking: boolean
    showArtifacts: boolean
    latestArtifacts: AIArtifact[]
    showWorkspaceDetails: boolean
    workspaceDetailsOpen: boolean
    onToggleWorkspaceDetails: () => void
    onToggleMobileChats: () => void
    onToggleArtifacts: () => void
}

export function ChatHeader({ conversation, isThinking, showWorkspaceDetails, workspaceDetailsOpen, onToggleWorkspaceDetails, onToggleMobileChats, showArtifacts, latestArtifacts, onToggleArtifacts }: ChatHeaderProps) {

    return <div className='relative z-10 w-full max-w-full border-b border-ui-border/70 px-4 py-2 sm:px-7'>
        <div className='flex min-w-0 items-center justify-between gap-4'>
            <div className='flex min-w-0 items-center gap-2'>
                <button type='button' aria-label='Chats' title='Chats' onClick={onToggleMobileChats} className='grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ui-muted transition-colors hover:bg-ui-raised hover:text-ui-text md:hidden'><PanelLeft className='h-4 w-4' /></button>
                <div className='min-w-0'>
                    {conversation?.messages.length ? <h1 className='truncate text-sm font-medium text-ui-text'>{conversationTitle(conversation.title)}</h1> : null}
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
