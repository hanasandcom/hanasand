import Link from 'next/link'
import { AlertTriangle, CheckCircle2, LoaderCircle } from 'lucide-react'


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
