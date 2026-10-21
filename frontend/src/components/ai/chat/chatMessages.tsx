'use client'

import { useState, type ReactElement, type ReactNode } from 'react'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { AlertTriangle, Check, CheckCircle2, Clipboard, LoaderCircle } from 'lucide-react'

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

export function EmptyComposerState({ hasReadyModel, isAuthenticated }: { hasReadyModel: boolean, isAuthenticated: boolean }) {
    return (
        <div className='flex h-full min-h-[28rem] items-center justify-center'>
            <div className='max-w-xl text-center'>
                <h2 className='text-2xl font-medium tracking-tight text-ui-text sm:text-3xl'>
                    What can I help with?
                </h2>
                {!hasReadyModel ? (
                    <div className='mt-4 flex flex-wrap justify-center gap-2 text-xs text-ui-muted'>
                        <Link href='/s' className='inline-flex min-h-8 items-center rounded-lg border border-ui-border bg-ui-panel px-3 py-1.5 font-semibold transition-colors hover:bg-ui-raised hover:text-ui-text'>
                            Open context
                        </Link>
                        {!isAuthenticated ? (
                            <Link href='/login' className='inline-flex min-h-8 items-center rounded-lg border border-ui-border bg-ui-panel px-3 py-1.5 font-semibold transition-colors hover:bg-ui-raised hover:text-ui-text'>
                                Sign in
                            </Link>
                        ) : null}
                    </div>
                ) : null}
            </div>
        </div>
    )
}

export function ToolMessage({
    message,
    artifacts,
}: {
    message: AIConversationMessage
    artifacts: AIArtifact[]
}) {
    const state = typeof message.metadata?.toolState === 'string' ? message.metadata.toolState : 'running'
    const browserSummary = getBrowserVerificationSummary(message, artifacts)
    const [label, ...detailParts] = message.content.split('\n\n')
    const detail = detailParts.join('\n\n').trim()

    return (
        <div className='space-y-2'>
            <div className='flex min-w-0 items-center gap-2 text-sm text-ui-muted'>
                {state === 'running'
                    ? <LoaderCircle aria-label='In progress' className='h-4 w-4 shrink-0 animate-spin text-ui-primary' />
                    : state === 'error'
                        ? <AlertTriangle aria-label='Failed' className='h-4 w-4 shrink-0 text-ui-warning' />
                        : <CheckCircle2 aria-label='Done' className='h-4 w-4 shrink-0 text-ui-success' />}
                <span className='min-w-0 truncate'>{label}</span>
            </div>
            {browserSummary ? <BrowserVerificationCard summary={browserSummary} /> : null}
            {detail ? <details className='group ml-6 text-xs text-ui-muted'>
                <summary className='w-fit cursor-pointer list-none rounded px-1 py-0.5 hover:bg-ui-raised hover:text-ui-text [&::-webkit-details-marker]:hidden'>Details</summary>
                <div className='mt-1 whitespace-pre-wrap wrap-break-word border-l border-ui-border pl-3 leading-5'>{detail}</div>
            </details> : null}
        </div>
    )
}

function BrowserVerificationCard({
    summary,
}: {
    summary: {
        status: 'passed' | 'issues'
        url: string | null
        title: string | null
        pageErrors: string[]
        consoleMessages: string[]
        hasScreenshot: boolean
    }
}) {
    const issueLines = [...summary.pageErrors, ...summary.consoleMessages].slice(0, 4)

    return (
        <div className={`rounded-lg border px-4 py-3 ${summary.status === 'passed' ? 'border-ui-success/30 bg-ui-success/10 text-ui-success' : 'border-ui-warning/30 bg-ui-warning/10 text-ui-warning'}`}>
            <div className='flex items-start gap-3'>
                <div className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${summary.status === 'passed' ? 'bg-ui-success/15 text-ui-success' : 'bg-ui-warning/15 text-ui-warning'}`}>
                    {summary.status === 'passed' ? <CheckCircle2 className='h-4 w-4' /> : <AlertTriangle className='h-4 w-4' />}
                </div>
                <div className='min-w-0 flex-1'>
                    <div className='text-[10px] uppercase tracking-[0.18em] text-current/70'>Browser verification</div>
                    <div className='mt-1 text-sm font-medium'>
                        {summary.status === 'passed' ? 'Verification passed' : 'Verification found issues'}
                    </div>
                    <div className='mt-2 flex flex-wrap gap-2 text-[11px] text-current/80'>
                        {summary.title ? <span className='rounded-full bg-ui-canvas/20 px-2.5 py-1'>{summary.title}</span> : null}
                        {summary.url ? <span className='rounded-full bg-ui-canvas/20 px-2.5 py-1'>{summary.url}</span> : null}
                        <span className='rounded-full bg-ui-canvas/20 px-2.5 py-1'>{summary.hasScreenshot ? 'Screenshot captured' : 'No screenshot'}</span>
                        <span className='rounded-full bg-ui-canvas/20 px-2.5 py-1'>{summary.pageErrors.length} page error{summary.pageErrors.length === 1 ? '' : 's'}</span>
                        <span className='rounded-full bg-ui-canvas/20 px-2.5 py-1'>{summary.consoleMessages.length} console message{summary.consoleMessages.length === 1 ? '' : 's'}</span>
                    </div>
                    {issueLines.length ? (
                        <div className='mt-3 space-y-1 text-xs text-current/90'>
                            {issueLines.map((line, index) => (
                                <div key={`${line}-${index}`} className='rounded-lg bg-ui-canvas/20 px-2.5 py-2'>
                                    {line}
                                </div>
                            ))}
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    )
}

function getBrowserVerificationSummary(message: AIConversationMessage, artifacts: AIArtifact[]) {
    if (!message.content.includes('Tool browser_task executed')) {
        return null
    }

    const lines = message.content.split('\n')
    const url = lines.find((line) => line.startsWith('Tool browser_task executed for URL: '))?.replace('Tool browser_task executed for URL: ', '') || null
    const title = lines.find((line) => line.startsWith('Title: '))?.replace('Title: ', '') || null
    const pageErrors = extractBrowserSection(message.content, 'Page errors:')
    const consoleMessages = extractBrowserSection(message.content, 'Console:')
    const hasScreenshot = artifacts.some((artifact) => artifact.kind === 'screenshot')

    return {
        status: (pageErrors.length || consoleMessages.length || message.error ? 'issues' : 'passed') as 'issues' | 'passed',
        url,
        title,
        pageErrors,
        consoleMessages,
        hasScreenshot,
    }
}

function extractBrowserSection(content: string, label: string) {
    const normalized = content.replace(/\r\n/g, '\n')
    const marker = `${label}\n`
    const startIndex = normalized.indexOf(marker)

    if (startIndex === -1) {
        return []
    }

    const sectionStart = startIndex + marker.length
    const remaining = normalized.slice(sectionStart)
    const sectionEnd = remaining.indexOf('\n\n')
    const rawSection = (sectionEnd === -1 ? remaining : remaining.slice(0, sectionEnd)).trim()

    if (!rawSection || rawSection === '<none>') {
        return []
    }

    return rawSection.split('\n').map((line) => line.trim()).filter(Boolean)
}
