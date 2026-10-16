import type { RefObject } from 'react'
import { ArtifactList } from './chatArtifacts'
import { EmptyComposerState, MarkdownBlock, ToolMessage } from './chatMessages'

export function ChatTranscript({ conversation, scrollRef, emptyTooltip, hasReadyModel, isAuthenticated, onPreview }: {
    conversation: AIConversation | null
    scrollRef: RefObject<HTMLDivElement | null>
    emptyTooltip: string
    hasReadyModel: boolean
    isAuthenticated: boolean
    onPreview: (artifact: AIArtifact | null) => void
}) {
    return <div ref={scrollRef} className='min-h-0 w-full max-w-full space-y-5 overflow-y-auto px-5 py-8 md:px-12 xl:px-24'>
        {!conversation?.messages.length ? <EmptyComposerState tooltip={emptyTooltip} hasReadyModel={hasReadyModel} isAuthenticated={isAuthenticated} /> : conversation.messages.map(message => {
            const artifacts = Array.isArray(message.metadata?.artifacts) ? message.metadata.artifacts as AIArtifact[] : []
            return <article key={message.id} className={`max-w-3xl rounded-lg border px-4 py-3 ${message.role === 'user' ? 'ml-auto border-ui-border bg-ui-panel text-ui-text shadow-sm' : message.error ? 'border-ui-danger/30 bg-ui-raised/10 text-ui-text' : message.role === 'tool' ? 'border-ui-border bg-ui-raised text-ui-muted' : 'border-transparent bg-transparent text-ui-text'}`}>
                {message.role === 'tool' || message.role === 'assistant' ? <div className='mb-2 flex items-center justify-between gap-3 text-[10px] font-semibold uppercase text-ui-muted'>
                    <span>{message.role === 'tool' ? message.content.split('\n')[0] || 'tool' : message.role}</span>
                    <span>{message.role === 'assistant' ? message.modelName || conversation.activeModel || 'assistant' : null}</span>
                </div> : null}
                {message.role === 'user' ? <div className='whitespace-pre-wrap wrap-break-word text-sm leading-6'>{message.content}</div> : message.role === 'tool' ? <ToolMessage message={message} artifacts={artifacts} /> : <MarkdownBlock content={message.content} />}
                <ArtifactList artifacts={artifacts} onPreview={onPreview} />
            </article>
        })}
    </div>
}
