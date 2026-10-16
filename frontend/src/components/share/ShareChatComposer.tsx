import type { Dispatch, RefObject, SetStateAction, SyntheticEvent } from 'react'
import { ArrowUp } from 'lucide-react'

type Props = {
    formRef: RefObject<HTMLFormElement | null>
    inputRef: RefObject<HTMLTextAreaElement | null>
    submit: (event?: SyntheticEvent<HTMLFormElement>) => Promise<void>
    input: string
    setInput: Dispatch<SetStateAction<string>>
    showBuilderWorkflow: boolean
    canSend: boolean
    submitPrompt: (prompt: string) => Promise<void>
    readSubmittedPrompt: (form?: HTMLFormElement) => string
    pendingEditBlocksNewRun: boolean
}

export function ShareChatComposer({ formRef, inputRef, submit, input, setInput, showBuilderWorkflow, canSend, submitPrompt, readSubmittedPrompt, pendingEditBlocksNewRun }: Props) {
    return (
        <form ref={formRef} onSubmit={submit} className='border-t border-ui-border p-3'>
            <div className='flex items-end gap-2 rounded-2xl border border-ui-border bg-ui-panel/[0.045] p-2'>
                <input type='hidden' name='shareChatPromptFallback' value={input} />
                <textarea
                    ref={inputRef}
                    name='shareChatPrompt'
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onInput={(event) => setInput(event.currentTarget.value)}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                            event.preventDefault()
                            event.currentTarget.form?.requestSubmit()
                        }
                    }}
                    placeholder={showBuilderWorkflow ? 'Describe what you want to build or change...' : 'Ask about this project...'}
                    className='max-h-36 min-h-11 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-ui-text outline-none placeholder:text-ui-text/35'
                    rows={1}
                />
                <button
                    type='button'
                    disabled={!canSend}
                    onClick={() => void submitPrompt(readSubmittedPrompt(formRef.current || undefined))}
                    aria-label='Send message'
                    className='grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full bg-ui-panel text-background transition hover:bg-ui-panel/88 disabled:cursor-default disabled:opacity-35'
                >
                    <ArrowUp className='h-4 w-4' />
                </button>
            </div>
            {pendingEditBlocksNewRun ? (
                <p className='mt-2 text-xs text-ui-text/42'>
                    Choose Apply changes or Discard before asking for another edit.
                </p>
            ) : null}
        </form>
    )
}
