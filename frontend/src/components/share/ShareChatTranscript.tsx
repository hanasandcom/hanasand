import { ClipboardCheck, ExternalLink, Globe2, Loader2, Sparkles } from 'lucide-react'
import { friendlyActivityMessage } from './shareChatPresentation'
import { BrowserEvidenceCard } from './ShareChatEvidence'
import type { BrowserEvidence, BrowserTarget, Message, PlainProjectState } from './shareChatTypes'

type Props = {
    messages: Message[]
    showBuilderWorkflow: boolean
    loading: boolean
    projectState: PlainProjectState
    browserTarget: BrowserTarget | null
    browserEvidence: BrowserEvidence[]
    workspaceMode: boolean
}

export function ShareChatTranscript({ messages, showBuilderWorkflow, loading, projectState, browserTarget, browserEvidence, workspaceMode }: Props) {
    return (
        <div className={`flex-1 space-y-3 overflow-y-auto px-3 py-4 ${workspaceMode ? 'lg:px-6 lg:py-5' : ''}`}>
            {messages.length === 0 ? (
                <div className='grid h-full place-items-center text-center'>
                    <div>
                        <div className='mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-ui-panel/7 text-ui-text/70'>
                            <Sparkles className='h-5 w-5' />
                        </div>
                        <h3 className='text-base font-semibold text-ui-text/90'>{showBuilderWorkflow ? 'Ready to build.' : 'Ask without changing files.'}</h3>
                        <p className='mt-1 max-w-xs text-sm leading-5 text-ui-text/48'>
                            {showBuilderWorkflow
                                ? 'Describe the result you want. Hanasand prepares changes for your review.'
                                : 'Use Ask for explanations. Switch to Build only when you want reviewable project changes.'}
                        </p>
                    </div>
                </div>
            ) : messages.map((message) => {
                const activity = message.role === 'tool' ? friendlyActivityMessage(message.content) : null
                return (
                    <article key={message.id} className={`max-w-[92%] rounded-2xl px-3 py-2 text-sm leading-6 ${
                        message.role === 'user'
                            ? 'ml-auto bg-ui-panel/12 text-ui-text'
                            : message.role === 'tool'
                                ? 'border border-ui-border bg-ui-canvas/18 text-ui-text/62'
                                : 'bg-ui-panel/[0.055] text-ui-text/82'
                    }`}>
                        {activity ? (
                            <div className='flex items-start gap-2'>
                                <ClipboardCheck className='mt-1 h-3.5 w-3.5 shrink-0 text-ui-primary' />
                                <div>
                                    <p className='font-medium text-ui-text/72'>{activity.title}</p>
                                    <p className='text-xs leading-5 text-ui-text/48'>{activity.detail}</p>
                                </div>
                            </div>
                        ) : (
                            <p className='whitespace-pre-wrap wrap-break-word'>{message.content}</p>
                        )}
                    </article>
                )
            })}
            {loading ? (
                <div className='flex items-center gap-2 text-sm text-ui-text/55'>
                    <Loader2 className='h-4 w-4 animate-spin' />
                    {projectState.label}: {projectState.detail}
                </div>
            ) : null}
            {browserTarget ? (
                <div className='overflow-hidden rounded-2xl border border-ui-border bg-ui-canvas/24'>
                    <div className='flex items-center justify-between gap-3 border-b border-ui-border px-3 py-2'>
                        <div className='flex min-w-0 items-center gap-2'>
                            <Globe2 className='h-4 w-4 shrink-0 text-ui-primary' />
                            <div className='min-w-0'>
                                <p className='truncate text-sm font-semibold text-ui-text/82'>{browserTarget.title}</p>
                                <p className='truncate text-xs text-ui-text/42'>{browserTarget.url}</p>
                            </div>
                        </div>
                        <a href={browserTarget.url} target='_blank' rel='noopener noreferrer' className='grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ui-text/52 transition hover:bg-ui-panel/8 hover:text-ui-text' aria-label='Open browser target in a new tab'>
                            <ExternalLink className='h-4 w-4' />
                        </a>
                    </div>
                    <iframe
                        src={browserTarget.url}
                        title={`Inline browser for ${browserTarget.title}`}
                        className='h-[min(34rem,52vh)] w-full border-0 bg-ui-panel'
                        sandbox='allow-forms allow-modals allow-popups allow-same-origin allow-scripts'
                    />
                </div>
            ) : null}
            {browserEvidence.map((evidence) => (
                <BrowserEvidenceCard key={evidence.id} evidence={evidence} />
            ))}
        </div>

    )
}
