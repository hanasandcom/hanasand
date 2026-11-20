import { Globe2 } from 'lucide-react'

export type WorldChatMessage = {
    id: number
    name: string
    body: string
    source: 'game' | 'web'
    created_at: string
}

function messageDate(value: string) {
    const iso = value.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00')
    const date = new Date(iso)
    return Number.isNaN(date.getTime()) ? null : date
}

function dayKey(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function dateLabel(date: Date, now: Date) {
    return dayKey(date) === dayKey(now)
        ? 'Today'
        : new Intl.DateTimeFormat('en', { dateStyle: 'long' }).format(date)
}

function timeLabel(date: Date) {
    return new Intl.DateTimeFormat('en', { timeStyle: 'short' }).format(date)
}

export default function GameChatMessages({ messages, now }: { messages: WorldChatMessage[], now: Date }) {
    return <div aria-live='polite' className='flex-1 overflow-y-auto p-4 text-sm'>
        {messages.map((message, index) => {
            const date = messageDate(message.created_at)
            const previous = messages[index - 1]
            const previousDate = previous ? messageDate(previous.created_at) : null
            const startsDay = index === 0 || (date && previousDate ? dayKey(date) !== dayKey(previousDate) : message.created_at !== previous?.created_at)
            const showName = startsDay || previous?.name !== message.name
            return <div key={message.id} className={showName ? 'mt-3' : 'mt-1'}>
                {startsDay && date && <div className='mb-3 flex items-center gap-3 text-xs text-ui-muted'>
                    <span className='h-px flex-1 bg-ui-border' />
                    <time dateTime={dayKey(date)}>{dateLabel(date, now)}</time>
                    <span className='h-px flex-1 bg-ui-border' />
                </div>}
                {showName && <strong className='mb-1 block text-xs font-semibold text-ui-muted'>{message.name}</strong>}
                <div className='group relative w-fit max-w-full'>
                    <p tabIndex={0} className='w-fit max-w-full whitespace-pre-wrap break-words rounded-2xl border border-ui-border bg-ui-raised px-3 py-2 text-ui-text'>
                        {message.source === 'web' && <span tabIndex={0} title='This message was sent from the website chat.' aria-label='Sent from website chat' className='mr-1 inline-flex align-middle'>
                            <Globe2 aria-hidden='true' className='h-3.5 w-3.5' />
                        </span>}
                        {message.body}
                    </p>
                    {date && <time dateTime={date.toISOString()} className='pointer-events-none absolute bottom-full left-0 z-10 mb-1 whitespace-nowrap rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-xs text-ui-muted opacity-0 shadow-ui-panel transition-opacity group-hover:opacity-100 group-focus-within:opacity-100'>
                        {timeLabel(date)}
                    </time>}
                </div>
            </div>
        })}
    </div>
}
