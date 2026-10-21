'use client'

import { useState, type ReactElement, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Check, Clipboard } from 'lucide-react'

const markdownClassName = [
    'max-w-none wrap-break-word text-[15px] leading-7 text-ui-text',
    '[&_p]:my-3 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0',
    '[&_h1]:mb-4 [&_h1]:mt-7 [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:tracking-tight',
    '[&_h2]:mb-3 [&_h2]:mt-7 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight',
    '[&_h3]:mb-2 [&_h3]:mt-5 [&_h3]:text-base [&_h3]:font-semibold',
    '[&_ul]:my-3 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6',
    '[&_ol]:my-3 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-6 [&_li]:pl-1',
    '[&_blockquote]:my-4 [&_blockquote]:border-l-2 [&_blockquote]:border-ui-primary/50',
    '[&_blockquote]:pl-4 [&_blockquote]:text-ui-muted',
    '[&_a]:text-ui-primary [&_a]:underline [&_a]:underline-offset-4',
    '[&_table]:my-4 [&_table]:w-full [&_table]:border-collapse',
    '[&_th]:border [&_th]:border-ui-border [&_th]:bg-ui-raised [&_th]:px-3 [&_th]:py-2',
    '[&_th]:text-left [&_td]:border [&_td]:border-ui-border [&_td]:px-3 [&_td]:py-2',
    '[&_hr]:my-6 [&_hr]:border-ui-border',
].join(' ')

const codeBlockClassName = [
    'my-4 overflow-hidden rounded-xl border border-ui-border bg-ui-canvas',
    '[&_code]:block [&_code]:min-w-0 [&_code]:overflow-x-auto',
    '[&_code]:rounded-none [&_code]:bg-transparent [&_code]:px-4 [&_code]:py-3',
    '[&_code]:font-mono [&_code]:text-[13px] [&_code]:leading-6 [&_code]:text-ui-text',
].join(' ')

export function MarkdownBlock({ content }: { content: string }) {
    return <div className={markdownClassName}>
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
                code({ className, children, ...props }) {
                    const language = /language-([\w-]+)/.exec(className || '')?.[1]
                    return language
                        ? <code className={`font-mono ${className || ''}`} {...props}>{String(children).replace(/\n$/, '')}</code>
                        : <code className='rounded bg-ui-raised px-1.5 py-0.5 font-mono text-[0.9em] text-ui-text' {...props}>{children}</code>
                },
                pre({ children }) {
                    return <CodeBlock>{children}</CodeBlock>
                },
            }}
        >
            {content}
        </ReactMarkdown>
    </div>
}

function CodeBlock({ children }: { children: ReactNode }) {
    const [copied, setCopied] = useState(false)
    const codeElement = children as ReactElement<{ children?: ReactNode, className?: string }>
    const code = String(codeElement.props.children ?? '')
    const language = /language-([\w-]+)/.exec(codeElement.props.className || '')?.[1]

    async function copyCode() {
        try {
            await navigator.clipboard.writeText(code)
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1500)
        } catch {
            setCopied(false)
        }
    }

    return <div className={codeBlockClassName}>
        <div className='flex h-9 items-center justify-between border-b border-ui-border px-3 text-xs text-ui-muted'>
            <span>{language || 'Code'}</span>
            <button type='button' onClick={() => void copyCode()} aria-label='Copy code' className='inline-flex items-center gap-1.5 rounded px-2 py-1 hover:bg-ui-raised hover:text-ui-text'>
                {copied ? <Check className='h-3.5 w-3.5' /> : <Clipboard className='h-3.5 w-3.5' />}
                {copied ? 'Copied' : 'Copy'}
            </button>
        </div>
        <pre className='m-0 overflow-x-auto'>{children}</pre>
    </div>
}
