import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import Link from 'next/link'
import { AlertTriangle, Filter, Play, RefreshCw, Trash2 } from 'lucide-react'
import type { AgentAutomation, AgentAutomationRun } from '@/utils/automations/client'
import ErrorNotice from '@/components/error/errorNotice'
import CertificateStatus from './certificateStatus'
import ExternalSender from './externalSender'
import useAutomationHistory from './useAutomationHistory'
import { HealthCheckStatusPill } from './healthCheckStatusPill'
import { automationInputClass, formatAutomationDate, formatAutomationInterval } from './automationDraft'

type Props = {
    automation: AgentAutomation
    runs: AgentAutomationRun[]
    history: ReturnType<typeof useAutomationHistory>
    historyFrom: string
    historyTo: string
    onHistoryFromChange: (value: string) => void
    onHistoryToChange: (value: string) => void
    showHistoryFilters: boolean
    onShowHistoryFiltersChange: (value: boolean) => void
    busy: string
    message: string
    onRun: () => void
    onEdit: () => void
    onDelete: () => void
    onRefresh: () => void
}

export function AutomationDetails({ automation, runs, history, historyFrom, historyTo, onHistoryFromChange, onHistoryToChange, showHistoryFilters, onShowHistoryFiltersChange, busy, message, onRun, onEdit, onDelete, onRefresh }: Props) {
    const missingUrl = automation.actionType === 'agent_prompt' && !automation.targetUrl
    const bottom = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!history.hasMore || history.loading || history.error || !bottom.current) return
        const observer = new IntersectionObserver(entries => {
            if (entries.some(entry => entry.isIntersecting)) history.loadMore()
        }, { root: bottom.current.parentElement, rootMargin: '100px' })
        observer.observe(bottom.current)
        return () => observer.disconnect()
    }, [history.hasMore, history.loading, history.error, history.loadMore])

    return <div className='grid gap-4'>
        <div className='flex flex-wrap items-start justify-between gap-3'>
            <div>
                <h2 className='text-xl font-semibold text-ui-text'>{automation.name}</h2>
                <HealthCheckStatusPill automation={automation} variant='details' />
            </div>
            <div className='flex gap-2'>
                <button type='button' onClick={onRun} disabled={busy === 'run' || missingUrl} className='inline-flex h-9 items-center gap-2 rounded-lg bg-ui-primary px-3 text-sm font-semibold text-ui-on-primary hover:opacity-90 disabled:opacity-50' title={missingUrl ? 'Add a URL before checking' : undefined}><Play className='h-4 w-4' />Check now</button>
                <button type='button' onClick={onEdit} className='h-9 rounded-lg border border-ui-border px-3 text-sm font-semibold text-ui-text'>Edit</button>
            </div>
        </div>
        <AutomationSummary automation={automation} missingUrl={missingUrl} />
        {automation.monitoringType === 'push' && <ExternalSender key={automation.id} id={automation.id} />}
        <MonitoringIssues history={history} />
        <RecentChecks runs={runs} history={history} historyFrom={historyFrom} historyTo={historyTo} onHistoryFromChange={onHistoryFromChange} onHistoryToChange={onHistoryToChange} showHistoryFilters={showHistoryFilters} onShowHistoryFiltersChange={onShowHistoryFiltersChange} onRefresh={onRefresh} bottom={bottom} />
        <div className='flex items-center justify-between border-t border-ui-border pt-3'>
            <span className='text-sm text-ui-muted'>{message}</span>
            <button type='button' onClick={onDelete} disabled={busy === 'delete'} className='inline-flex items-center gap-2 text-sm font-semibold text-ui-text hover:underline'><Trash2 className='h-4 w-4' />Delete</button>
        </div>
    </div>
}

function AutomationSummary({ automation, missingUrl }: { automation: AgentAutomation, missingUrl: boolean }) {
    return <div className='grid gap-3 rounded-lg border border-ui-border bg-ui-raised p-3 text-sm'>
        <div className='flex items-center justify-between gap-3'><p className='leading-6 text-ui-text'>{automation.prompt}</p><CertificateStatus automation={automation} /></div>
        <div className='grid gap-3 border-t border-ui-border pt-3 text-xs text-ui-muted sm:grid-cols-2'>
            {automation.actionType === 'agent_prompt' ? <span className={`break-all ${missingUrl ? 'font-semibold text-ui-text' : ''}`}>{missingUrl ? 'Missing URL' : `${automation.monitoringType === 'push' ? 'Source' : automation.monitoringType.toUpperCase()}: ${automation.targetUrl}`}</span> : null}
            <span>{formatAutomationInterval(automation.intervalMinutes)}</span>
            <span>{automation.monitoringType === 'push' ? `Offline after ${automation.timeoutSeconds}s without updates` : automation.actionType === 'agent_prompt' ? `Timeout: ${automation.timeoutSeconds || 1}s · ${automation.retryCount || 0} retries` : ''}</span>
            <span>{automation.modelName ? 'Notification destination configured' : 'No notification destination'}{!automation.modelName && automation.notifyOn !== 'never' ? <span className='ml-1 inline-flex align-text-bottom text-ui-warning' title='No delivery destination configured' aria-label='No delivery destination configured'><AlertTriangle className='h-4 w-4' /></span> : null}</span>
        </div>
    </div>
}

function MonitoringIssues({ history }: { history: ReturnType<typeof useAutomationHistory> }) {
    return <section aria-label='Monitoring issues' className='grid gap-2'>
        <h3 className='text-sm font-semibold text-ui-text'>Issues ({history.issues.length})</h3>
        <p className='text-xs text-ui-muted'>Discord receives @everyone and the case number, at most once per issue every 24 hours.</p>
        <div className='grid max-h-80 gap-2 overflow-y-auto'>
            {history.issues.map(issue => <details key={issue.id} id={issue.caseNumber} className='rounded-lg border border-ui-border bg-ui-raised p-3'>
                <summary className='cursor-pointer text-sm text-ui-text'><Link href={`/cases/${encodeURIComponent(issue.caseNumber)}`} className='font-semibold text-ui-primary underline'>{issue.caseNumber}</Link> · {issue.resolvedAt ? 'Resolved' : 'Open'} · {issue.occurrences} occurrences</summary>
                <p className='mt-2 whitespace-pre-wrap wrap-break-word text-sm text-ui-text'>{issue.summary}</p>
                <p className='mt-2 text-xs text-ui-muted'>First seen: {formatAutomationDate(issue.firstSeenAt)} · Last seen: {formatAutomationDate(issue.lastSeenAt)}{issue.resolvedAt ? ` · Resolved: ${formatAutomationDate(issue.resolvedAt)}` : ''}</p>
                {issue.notifications.map((notification, index) => <p key={index} className='mt-2 text-xs text-ui-muted'>{notification.error ? `Discord delivery failed: ${notification.error}` : notification.deliveredAt ? `Discord notified: ${formatAutomationDate(notification.deliveredAt)}` : 'Discord delivery pending.'} Next eligible notification: {formatAutomationDate(notification.nextAttemptAt)}</p>)}
            </details>)}
        </div>
        {!history.issues.length ? <p className='text-sm text-ui-muted'>{history.loading ? 'Loading issues…' : history.error ? 'Issues are unavailable.' : 'No issues recorded.'}</p> : null}
    </section>
}

function RecentChecks({ runs, history, historyFrom, historyTo, onHistoryFromChange, onHistoryToChange, showHistoryFilters, onShowHistoryFiltersChange, onRefresh, bottom }: { runs: AgentAutomationRun[], history: ReturnType<typeof useAutomationHistory>, historyFrom: string, historyTo: string, onHistoryFromChange: (value: string) => void, onHistoryToChange: (value: string) => void, showHistoryFilters: boolean, onShowHistoryFiltersChange: (value: boolean) => void, onRefresh: () => void, bottom: RefObject<HTMLDivElement | null> }) {
    return <div>
        <div className='mb-2 flex flex-wrap items-center justify-between gap-2'>
            <h3 className='text-sm font-semibold text-ui-text'>Recent checks <span className='font-normal text-ui-muted'>({runs.length}/{history.total})</span></h3>
            <div className='flex items-center gap-2'>
                <button type='button' onClick={() => onShowHistoryFiltersChange(!showHistoryFilters)} className={`rounded-md p-1.5 ${showHistoryFilters || historyFrom || historyTo ? 'bg-ui-primary/10 text-ui-primary' : 'text-ui-muted hover:text-ui-text'}`} aria-label='Filter checks by time' aria-pressed={showHistoryFilters} title='Filter checks by time'><Filter className='h-4 w-4' /></button>
                <button type='button' onClick={onRefresh} className='text-ui-muted hover:text-ui-text' aria-label='Refresh checks' title='Refresh checks'><RefreshCw className='h-4 w-4' /></button>
            </div>
        </div>
        {showHistoryFilters && <div className='mb-2 grid gap-2 sm:grid-cols-2'>
            <label className='grid gap-1 text-xs text-ui-muted'><span>From</span><input type='datetime-local' value={historyFrom} onChange={event => onHistoryFromChange(event.target.value)} className={automationInputClass} /></label>
            <label className='grid gap-1 text-xs text-ui-muted'><span>To</span><input type='datetime-local' value={historyTo} onChange={event => onHistoryToChange(event.target.value)} className={automationInputClass} /></label>
        </div>}
        <div className='grid max-h-[32rem] gap-2 overflow-y-auto pr-1'>
            {runs.map(run => <div key={run.id} className='rounded-lg border border-ui-border bg-ui-raised p-3'>
                <div className='flex justify-between gap-2 text-xs text-ui-muted'><span>{formatAutomationDate(run.startedAt)}{run.caseNumber ? <> · <Link href={`/cases/${encodeURIComponent(run.caseNumber)}`} className='text-ui-primary underline'>{run.caseNumber}</Link></> : null}</span><span className={run.status === 'failed' ? 'font-semibold text-ui-text' : run.warning ? 'font-semibold text-ui-warning' : 'font-semibold text-ui-success'}>{run.warning ? 'warning' : run.status}</span></div>
                {run.status === 'failed' ? <ErrorNotice compact className='mt-2' message={run.error || 'Check failed.'} /> : <p className='mt-2 whitespace-pre-wrap text-sm leading-6 text-ui-muted'>{run.result || 'Check completed.'}</p>}
            </div>)}
            {!runs.length && <p className='rounded-lg border border-dashed border-ui-border p-4 text-sm text-ui-muted'>{history.loading ? 'Loading checks…' : history.error ? 'Checks are unavailable.' : 'No checks yet. Run it now or wait for the next check.'}</p>}
            <div ref={bottom} aria-live='polite'>{history.loading ? 'Loading checks…' : history.error ? <button type='button' onClick={history.loadMore}>Retry: {history.error}</button> : history.hasMore ? <button type='button' onClick={history.loadMore}>Load more checks</button> : null}</div>
        </div>
    </div>
}
