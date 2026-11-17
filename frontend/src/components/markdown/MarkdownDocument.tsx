import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { isValidElement } from 'react'
import Timeline, { parseTimeline } from './timeline'
import styles from './MarkdownDocument.module.css'

export default function MarkdownDocument({ text }: { text: string }) {
    return <div className={styles.document}>
        <Markdown remarkPlugins={[remarkGfm]} components={{
            pre({ children }) {
                if (isValidElement<{ className?: string }>(children) && children.props.className === 'language-timeline') return <>{children}</>
                return <pre>{children}</pre>
            },
            code({ className, children, ...props }) {
                if (className === 'language-timeline') {
                    const items = parseTimeline(String(children).trim())
                    if (items) return <Timeline items={items} />
                }
                return <code className={className} {...props}>{children}</code>
            },
            img({ src, alt, ...props }) {
                return <img {...props} src={src} alt={alt || ''} className='h-auto max-w-full rounded-md' />
            },
        }}>{text}</Markdown>
    </div>
}
