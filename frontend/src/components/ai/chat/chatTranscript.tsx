import type { RefObject } from 'react'
import { ArrowDown, ArrowUp, Pencil, Trash2 } from 'lucide-react'
import { ArtifactList } from './chatArtifacts'
import { EmptyComposerState, MarkdownBlock, ToolMessage } from './chatMessages'

export function ChatTranscript({ conversation, scrollRef, emptyTooltip, hasReadyModel, isAuthenticated, onEditPrompt, onDeletePrompt, onMovePrompt, onPreview }: {
    conversation: AIConversation | null
    scrollRef: RefObject<HTMLDivElement | null>
    emptyTooltip: string
    hasReadyModel: boolean
    isAuthenticated: boolean
    onEditPrompt: (id: string) => void
    onDeletePrompt: (id: string) => void
    onMovePrompt: (id: string, direction: 'up' | 'down') => void
    onPreview: (artifact: AIArtifact | null) => void
}) {
    return <div ref={scrollRef} className='min-h-0 w-full max-w-full space-y-5 overflow-y-auto px-4 py-8 md:px-8 xl:px-16'>
        {!conversation?.messages.length ? <EmptyComposerState tooltip={emptyTooltip} hasReadyModel={hasReadyModel} isAuthenticated={isAuthenticated} /> : conversation.messages.map(message => {
            const artifacts = Array.isArray(message.metadata?.artifacts) ? message.metadata.artifacts as AIArtifact[] : []
            const isPromptPortalMessage = typeof message.metadata?.promptPortalId === 'string' && message.role === 'assistant'
            return <article key={message.id} className={`max-w-3xl rounded-2xl border px-4 py-3.5 ${message.role === 'user' ? 'ml-auto border-ui-border bg-ui-raised text-ui-text shadow-sm' : message.error ? 'border-ui-danger/30 bg-ui-raised/10 text-ui-text' : message.role === 'tool' ? 'border-ui-border bg-ui-raised text-ui-muted' : 'border-transparent bg-transparent text-ui-text'}`}>
                {message.role === 'tool' || message.role === 'assistant' ? <div className={`mb-2 flex items-center justify-between gap-3 text-ui-muted ${isPromptPortalMessage ? 'border-b border-ui-border pb-2 text-sm font-normal normal-case' : 'text-[10px] font-semibold uppercase'}`}>
                    <span>{message.role === 'tool' ? message.content.split('\n')[0] || 'tool' : typeof message.metadata?.statusText === 'string' ? message.metadata.statusText : message.role}</span>
                    <span>{message.role === 'assistant' && !isPromptPortalMessage ? message.modelName || conversation.activeModel || 'assistant' : null}</span>
                </div> : null}
                {message.role === 'user' ? <>
                    <div className='whitespace-pre-wrap wrap-break-word text-[15px] leading-7'>{message.content}</div>
                    {Array.isArray(message.metadata?.files) && message.metadata.files.length ? <div className='mt-2 text-xs text-ui-muted'>{message.metadata.files.length} image{message.metadata.files.length === 1 ? '' : 's'} attached</div> : null}
                    {typeof message.metadata?.promptPortalId === 'string' && message.metadata.promptPortalStatus === 'queued' ? <PromptActions id={message.metadata.promptPortalId} onEdit={onEditPrompt} onDelete={onDeletePrompt} onMove={onMovePrompt} /> : null}
                </> : message.role === 'tool' ? <ToolMessage message={message} artifacts={artifacts} /> : <MarkdownBlock content={message.content} />}
                <ArtifactList artifacts={artifacts} onPreview={onPreview} />
            </article>
        })}
    </div>
}

function PromptActions({ id, onEdit, onDelete, onMove }: { id: string, onEdit: (id: string) => void, onDelete: (id: string) => void, onMove: (id: string, direction: 'up' | 'down') => void }) {
    return <div className='mt-2 flex justify-end gap-1'>
        <button type='button' aria-label='Move instruction up' title='Move up' onClick={() => onMove(id, 'up')} className={actionButton}><ArrowUp className='h-3.5 w-3.5' /></button>
        <button type='button' aria-label='Move instruction down' title='Move down' onClick={() => onMove(id, 'down')} className={actionButton}><ArrowDown className='h-3.5 w-3.5' /></button>
        <button type='button' aria-label='Edit instruction' title='Edit' onClick={() => onEdit(id)} className={actionButton}><Pencil className='h-3.5 w-3.5' /></button>
        <button type='button' aria-label='Delete instruction' title='Delete' onClick={() => onDelete(id)} className={actionButton}><Trash2 className='h-3.5 w-3.5' /></button>
    </div>
}

const actionButton = 'grid h-7 w-7 place-items-center rounded-full text-ui-muted hover:bg-ui-canvas hover:text-ui-text'
