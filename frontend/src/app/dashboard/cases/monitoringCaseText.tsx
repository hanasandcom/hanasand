import Markdown from 'react-markdown'

export function date(value?: string, empty = '—') {
    return value ? new Date(value).toLocaleString() : empty
}

export function notificationText(text: string) {
    return text.replace(/<t:(\d+)(?::[tTdDfFR])?>/g, (match, seconds) => {
        const timestamp = new Date(Number(seconds) * 1000)
        return Number.isFinite(timestamp.getTime()) ? date(timestamp.toISOString()) : match
    })
}

export function NotificationText({ text }: { text: string }) {
    return <div className='whitespace-pre-wrap'><Markdown skipHtml allowedElements={['p', 'strong', 'em', 'a', 'code', 'br', 'ul', 'ol', 'li', 'blockquote']} components={{ a: ({ href, children }) => <a href={href} className='text-ui-primary underline' target='_blank' rel='noopener noreferrer'>{children}</a> }}>{notificationText(text)}</Markdown></div>
}

export function formatDirectorySize(bytes: number) {
    const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB']
    const index = bytes > 0 ? Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024))) : 0
    return `${(bytes / 1024 ** index).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${units[index]}`
}
