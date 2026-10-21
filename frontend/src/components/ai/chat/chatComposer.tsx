import { ArrowDown, ArrowUp, Image, LoaderCircle, RefreshCw, X } from 'lucide-react'
import { useEffect, useRef } from 'react'

export function ChatComposer({ value, blockedReason, awaitingResponse, readOnly, provider, promptPriority, promptFiles, promptBusy, promptError, onPromptPriorityChange, onPromptFilesChange, onRefreshPrompts, onChange, onSend }: {
    value: string
    blockedReason: string | null
    awaitingResponse: boolean
    readOnly: boolean
    provider: 'hanasand' | 'chatgpt'
    promptPriority: 'now' | 'next'
    promptFiles: FileList | null
    promptBusy: boolean
    promptError: string
    onPromptPriorityChange: (value: 'now' | 'next') => void
    onPromptFilesChange: (files: FileList | null) => void
    onRefreshPrompts: () => void
    onChange: (value: string) => void
    onSend: () => void
}) {
    const fileInput = useRef<HTMLInputElement>(null)
    const blocked = Boolean(blockedReason)

    useEffect(() => { if (!promptFiles && fileInput.current) fileInput.current.value = '' }, [promptFiles])

    return <div className='relative z-10 bg-ui-canvas px-3 pb-4 pt-3 md:px-8 md:pb-6'>
        <div className='mx-auto max-w-4xl'>
            {promptError ? <p role='alert' className='mb-2 rounded-xl border border-ui-danger/30 bg-ui-panel px-4 py-2 text-sm text-ui-text'>{promptError}</p> : null}
            {blockedReason ? <p id='ai-composer-blocked-reason' className='mb-2 px-3 text-xs text-ui-muted'>{blockedReason}</p> : null}
            <div className='rounded-3xl border border-ui-border bg-ui-panel shadow-lg shadow-black/10 transition focus-within:border-ui-primary/60 focus-within:ring-2 focus-within:ring-ui-primary/15'>
                <textarea value={value} onChange={event => onChange(event.target.value)} onKeyDown={event => {
                    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); onSend() }
                }} placeholder='Message…' readOnly={readOnly} rows={2} aria-label='Message' className='block max-h-48 min-h-16 w-full resize-y rounded-t-3xl bg-transparent px-5 pt-4 text-[15px] leading-6 text-ui-text outline-none placeholder:text-ui-muted' />
                <div className='flex flex-wrap items-center gap-1.5 px-3 pb-2 pt-1'>
                    {provider === 'chatgpt' ? <>
                        <button type='button' onClick={() => fileInput.current?.click()} aria-label='Attach images' title='Attach images' className={roundButton}><Image className='h-4 w-4' /></button>
                        <input ref={fileInput} type='file' accept='image/*' multiple onChange={event => onPromptFilesChange(event.target.files)} className='sr-only' />
                        {promptFiles?.length ? <span className='inline-flex items-center gap-1 rounded-full bg-ui-raised px-2.5 py-1 text-xs text-ui-muted'>{promptFiles.length} image{promptFiles.length === 1 ? '' : 's'}<button type='button' aria-label='Remove attached images' onClick={() => { onPromptFilesChange(null); if (fileInput.current) fileInput.current.value = '' }}><X className='h-3.5 w-3.5' /></button></span> : null}
                        <button type='button' aria-pressed={promptPriority === 'next'} onClick={() => onPromptPriorityChange('next')} className={promptPriority === 'next' ? selectedButton : plainButton}>Queue</button>
                        <button type='button' aria-pressed={promptPriority === 'now'} onClick={() => onPromptPriorityChange('now')} className={promptPriority === 'now' ? selectedButton : plainButton}><ArrowDown className='h-3.5 w-3.5' />Now</button>
                        <button type='button' aria-label='Refresh ChatGPT activity' title='Refresh activity' onClick={onRefreshPrompts} className={roundButton}><RefreshCw className='h-4 w-4' /></button>
                    </> : null}
                    <button type='button' aria-label='Send' aria-describedby={blockedReason ? 'ai-composer-blocked-reason' : undefined} title={blockedReason || undefined} disabled={blocked || promptBusy || awaitingResponse || !value.trim()} onClick={onSend} className='ml-auto grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ui-text text-ui-canvas transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45'>
                        {promptBusy || awaitingResponse ? <LoaderCircle className='h-4 w-4 animate-spin' /> : <ArrowUp className='h-4 w-4 stroke-[2.8]' />}
                    </button>
                </div>
            </div>
        </div>
    </div>
}

const roundButton = 'grid h-9 w-9 place-items-center rounded-full text-ui-muted transition hover:bg-ui-raised hover:text-ui-text'
const plainButton = 'inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-ui-muted transition hover:bg-ui-raised hover:text-ui-text'
const selectedButton = 'inline-flex h-8 items-center gap-1.5 rounded-full bg-ui-raised px-3 text-xs font-semibold text-ui-text'
