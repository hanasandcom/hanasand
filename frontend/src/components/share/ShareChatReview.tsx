import { useState, type ReactNode } from 'react'
import { AlertTriangle, Check, ClipboardCheck, FileText, Loader2, RotateCw } from 'lucide-react'
import type { BrowserEvidence, PendingShareChange, PlainProjectState, RunSummary } from './shareChatTypes'
import { extractVisibleCopy, journeyTypeLabels, plainChangeTitle, plainImpactForPath, plainPathLabel } from './shareChatPresentation'
import { buildDiff, summarizePendingChange } from './shareChatChanges'
import { EvidenceList } from './ShareChatEvidence'

export function ProjectStateIcon({ state, loading }: { state: PlainProjectState, loading: boolean }) {
    const className = 'mt-0.5 h-4 w-4 shrink-0 text-ui-primary'
    if (loading || state.label === 'Planning' || state.label === 'Editing' || state.label === 'Verifying') {
        return <Loader2 className={`${className} animate-spin`} />
    }
    if (state.label === 'Needs you') {
        return <AlertTriangle className={className} />
    }
    if (state.label === 'Failed with fix') {
        return <RotateCw className={className} />
    }
    return <Check className={className} />
}

export function PlainMetric({ icon, label, value }: { icon: ReactNode, label: string, value: string }) {
    return (
        <div className='flex min-w-0 items-center gap-1.5 rounded-lg border border-ui-border bg-ui-panel/[0.035] px-2 py-1.5'>
            <span className='shrink-0 text-ui-primary'>{icon}</span>
            <span className='min-w-0 truncate text-ui-text/42'>{label}</span>
            <span className='ml-auto shrink-0 font-semibold text-ui-text/68'>{value}</span>
        </div>
    )
}

function ReviewMetricCard({ label, children, valueClassName = 'font-medium text-ui-text/68' }: { label: string, children: ReactNode, valueClassName?: string }) {
    return <div className='rounded-lg border border-ui-border bg-ui-panel/[0.035] px-2 py-1.5'>
        <span className='block text-ui-text/35'>{label}</span>
        <span className={valueClassName}>{children}</span>
    </div>
}

export function ChangeSummaryCard({ change }: { change: PendingShareChange }) {
    const [advancedOpen, setAdvancedOpen] = useState(false)
    const summary = summarizePendingChange(change)
    const visibleCopy = extractVisibleCopy(change.content)
    const firstAddedLine = /(?:^|\/)page\.tsx?$/i.test(change.path) ? change.content
        .split('\n')
        .map((line) => line.trimEnd().replace(/\s*<[^>]+>.*$/, '').trimEnd())
        .map((line) => line.replace(/(['"`])[^'"`]{20,}\1/g, '$1...$1'))
        .find((line) => line.trim().length > 0) : null
    return (
        <article className='rounded-2xl border border-ui-border bg-ui-canvas/24 p-3'>
            <div className='flex items-start justify-between gap-3'>
                <div className='min-w-0'>
                    <div className='flex items-center gap-2'>
                        <FileText className='h-4 w-4 shrink-0 text-ui-primary' />
                        <h4 className='truncate text-sm font-semibold text-ui-text/84'>{plainChangeTitle(change, summary.kind)}</h4>
                    </div>
                    <p className='mt-1 text-xs leading-5 text-ui-text/48'>{plainPathLabel(change.path)}</p>
                    <p className='mt-1 text-[11px] leading-4 text-ui-text/36'>{summary.action} {change.path}</p>
                </div>
                <span className='shrink-0 rounded-full border border-ui-border px-2 py-0.5 text-[11px] text-ui-text/52'>
                    {change.created ? 'New' : 'Updated'}
                </span>
            </div>
            <div className='mt-3 grid gap-2 text-[11px] text-ui-text/58 sm:grid-cols-3'>
                <ReviewMetricCard label='Type'>{summary.kind}</ReviewMetricCard>
                <ReviewMetricCard label='Size' valueClassName='flex flex-wrap items-center gap-1.5 font-medium text-ui-text/68'>
                    <span>{summary.totalLines} line{summary.totalLines === 1 ? '' : 's'}</span>
                    <span className='rounded-full border border-ui-success/10 px-1.5 py-0.5 text-ui-success/62'>+{summary.added}</span>
                    <span className='rounded-full border border-ui-danger/10 px-1.5 py-0.5 text-ui-text/62'>-{summary.removed}</span>
                </ReviewMetricCard>
                <ReviewMetricCard label='Impact'>{plainImpactForPath(change.path)}</ReviewMetricCard>
            </div>
            {visibleCopy.length ? (
                <div className='mt-3 rounded-lg border border-ui-border bg-ui-panel/[0.035] px-2 py-1.5 text-xs leading-5 text-ui-text/58'>
                    <span className='block text-[11px] font-medium text-ui-text/38'>Visible copy</span>
                    {visibleCopy.slice(0, 3).map((copy) => (
                        <p key={copy} className='mt-0.5'>{copy}</p>
                    ))}
                </div>
            ) : null}
            {firstAddedLine ? (
                <div className='mt-3 truncate rounded-lg border border-ui-success/10 bg-ui-success/10 px-2 py-1.5 font-mono text-xs text-ui-success/68'>
                    + {firstAddedLine}
                </div>
            ) : null}
            <details
                className='mt-3 rounded-lg border border-ui-border bg-ui-canvas/18 px-2 py-1.5'
                onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}
            >
                <summary className='cursor-pointer text-xs font-medium text-ui-text/58'>Advanced details</summary>
                <div className='mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-ui-text/52'>
                    <span className='rounded-full border border-ui-success/10 px-2 py-0.5 text-ui-success/62'>Added {summary.added}</span>
                    <span className='rounded-full border border-ui-danger/10 px-2 py-0.5 text-ui-text/62'>Removed {summary.removed}</span>
                    <span className='truncate text-ui-text/42'>Advanced path: {change.path} ({summary.action.toLowerCase()})</span>
                </div>
                {advancedOpen ? (
                    <pre className='mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-ui-canvas/24 p-2 text-xs leading-5 text-ui-text/64'>
                        {buildDiff(change.beforeContent, change.content)}
                    </pre>
                ) : null}
            </details>
        </article>
    )
}

export function ReviewEvidencePanel({ evidence, lastRun }: { evidence: BrowserEvidence | null, lastRun: RunSummary | null }) {
    const issues = evidence?.pageErrors?.filter(Boolean) || []
    const consoleMessages = evidence?.consoleMessages?.filter(Boolean) || []
    const screenshotState = evidence?.screenshotPath ? 'Screenshot saved' : lastRun?.browserProofs ? 'Screenshot not available yet' : 'Screenshot not run yet'
    const journey = evidence?.journeyProof
    const journeyLabels = journeyTypeLabels(journey)
    const journeyState = journey?.readiness?.submitWithoutMutationAvoided
        ? 'Safe dry-run complete'
        : journey
            ? 'Journey inspected'
            : 'Not run yet'
    return (
        <section className='mt-3 rounded-2xl border border-ui-border bg-ui-canvas/24 p-3'>
            <div className='flex items-start justify-between gap-3'>
                <div className='min-w-0'>
                    <div className='flex items-center gap-2'>
                        <ClipboardCheck className='h-4 w-4 text-ui-primary' />
                        <h4 className='text-sm font-semibold text-ui-text/84'>Production check for this review</h4>
                    </div>
                    <p className='mt-1 text-xs leading-5 text-ui-text/48'>
                        {evidence ? 'Rendered screenshots, logs, and journey checks are attached to the review.' : 'No production check has finished for this review yet.'}
                    </p>
                </div>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${
                    issues.length
                        ? 'border-ui-danger/15 text-ui-text/70'
                        : evidence
                            ? 'border-ui-success/15 text-ui-success/62'
                            : 'border-ui-border text-ui-text/45'
                }`}>
                    {issues.length ? 'Needs fix' : evidence ? 'Attached' : 'Pending'}
                </span>
            </div>
            <div className='mt-3 grid gap-2 text-[11px] text-ui-text/58 sm:grid-cols-4'>
                <ReviewMetricCard label='Screenshot'>{screenshotState}</ReviewMetricCard>
                <ReviewMetricCard label='Journey check'>{journeyState}</ReviewMetricCard>
                <ReviewMetricCard label='Page issues'>{issues.length ? `${issues.length} found` : evidence ? 'None found' : 'Not checked'}</ReviewMetricCard>
                <ReviewMetricCard label='Logs'>{consoleMessages.length ? `${consoleMessages.length} message${consoleMessages.length === 1 ? '' : 's'}` : evidence ? 'Quiet' : 'Not checked'}</ReviewMetricCard>
            </div>
            <details className='mt-3 rounded-lg border border-ui-border bg-ui-canvas/18 px-2 py-1.5'>
                <summary className='cursor-pointer text-xs font-medium text-ui-text/58'>Advanced logs</summary>
                <div className='mt-2 grid gap-2 text-xs text-ui-text/58 sm:grid-cols-2'>
                    <EvidenceList title='Page address' items={evidence?.url ? [evidence.url] : []} />
                    <EvidenceList title='Screenshot path' items={evidence?.screenshotPath ? [evidence.screenshotPath] : []} />
                    <EvidenceList title='Journey check' items={journey ? [
                        `${journey.filledControls || 0}/${journey.fillableControls || 0} fields safely filled`,
                        `Mutation avoided: ${journey.readiness?.submitWithoutMutationAvoided ? 'yes' : 'unknown'}`,
                        `Critical path: ${journeyLabels.length ? journeyLabels.join(', ') : 'not detected'}`,
                    ] : []} />
                    <EvidenceList title='Console messages' items={consoleMessages} />
                    <EvidenceList title='Page errors' items={issues} />
                </div>
            </details>
        </section>
    )
}
