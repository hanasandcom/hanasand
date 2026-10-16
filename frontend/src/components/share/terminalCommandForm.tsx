import type { RefObject, SyntheticEvent } from 'react'
import { useState } from 'react'
import { Send } from 'lucide-react'

type Props = {
    isConnected: boolean
    inputRef: RefObject<HTMLInputElement | null>
    sendInput(content: string): void
}

export default function TerminalCommandForm({ isConnected, inputRef, sendInput }: Props) {
    const [command, setCommand] = useState('')

    function submitCommand(event: SyntheticEvent<HTMLFormElement>) {
        event.preventDefault()
        const nextCommand = command.trim()
        if (!nextCommand) return
        sendInput(`${nextCommand}\r`)
        setCommand('')
    }

    return (
        <form
            onSubmit={submitCommand}
            className='absolute inset-x-2 bottom-2 z-20 flex flex-wrap items-center gap-2 rounded-md border border-ui-border bg-ui-panel px-2 py-1.5 shadow-lg backdrop-blur sm:flex-nowrap'
        >
            <span className='rounded bg-ui-raised px-2 py-1 text-[11px] font-semibold text-ui-primary'>
                Command
            </span>
            <input
                ref={inputRef}
                aria-label='Terminal command'
                value={command}
                onChange={event => setCommand(event.target.value)}
                placeholder={isConnected ? 'Run a command...' : 'Terminal is reconnecting...'}
                className='min-w-0 flex-1 bg-transparent px-1 text-sm text-ui-text outline-none placeholder:text-ui-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-primary'
                autoComplete='off'
                spellCheck={false}
            />
            <button
                type='submit'
                aria-label='Send terminal command'
                disabled={!command.trim()}
                className='grid h-8 w-8 place-items-center rounded-md bg-ui-success/15 text-ui-success transition hover:bg-ui-success/25 disabled:cursor-not-allowed disabled:opacity-40'
            >
                <Send size={15} />
            </button>
        </form>
    )
}
