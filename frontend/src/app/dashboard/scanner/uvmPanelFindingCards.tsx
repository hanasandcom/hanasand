'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { UvmAssetCriticality, UvmDashboard, UvmFinding, UvmFindingGroup, UvmFindingTriageHistoryPage, UvmFindingUpdate } from '@/utils/monitoring/types'
import { filterAndSortUvmFindings, type UvmFindingFilters } from './uvmPanelFindingOrdering'
import { formatDate } from './uvmPanelHelpers'
import { UvmHelp } from './uvmPanelHelp'

type FindingCardSharedProps = {
    busy: string
    setFindingUpdates: Dispatch<SetStateAction<Record<string, UvmFindingUpdate>>>
    findingTriageHistoryAction: (findingId: string, cursor: string | null) => Promise<UvmFindingTriageHistoryPage>
    onViewRun: (runId: string, engine: string) => void
    onUpdate: (finding: UvmFinding) => void
}

export function FindingGroupCard({ group, filters, data, scoped, findingUpdates, ...actions }: FindingCardSharedProps & {
    group: UvmFindingGroup
    filters: UvmFindingFilters
    data: UvmDashboard
    scoped: boolean
    findingUpdates: Record<string, UvmFindingUpdate>
}) {
    const visibleMembers = filterAndSortUvmFindings(group.members, filters, data.assets)
    return <article className='rounded-md border border-ui-border bg-ui-raised p-3'>
        <div className='flex flex-wrap items-start justify-between gap-2'>
            <div>
                <div className='flex flex-wrap items-center gap-2'><strong>{group.cveIds.join(', ') || group.members[0]?.title || 'Correlated findings'}</strong><span className='rounded bg-ui-warning/15 px-2 py-0.5 text-[11px] font-semibold text-ui-warning'>{group.severity}</span><span className='text-xs text-ui-muted'>{group.engines.join(' · ')}</span></div>
                <p className='mt-1 text-xs text-ui-muted'>{group.asset}{group.address ? ` · ${group.address}` : ''}{group.affectedLocation ? ` · ${group.affectedLocation}` : ''}</p>
            </div>
            <span className='text-xs font-semibold'>{group.status.replaceAll('_', ' ')} · {group.members.length} records</span>
        </div>
        {group.members.length > 1 && <details className='mt-2 text-xs'>
            <summary className='cursor-pointer text-ui-muted'>Scanner records and individual triage · {group.members.length}</summary>
            {visibleMembers.length !== group.members.length && <p className='mt-1 text-ui-muted'>Showing {visibleMembers.length} of {group.members.length} records matching the current filters.</p>}
            <div className='mt-2 grid gap-2'>{visibleMembers.map(finding => <FindingCard key={finding.id} finding={finding}
                criticality={data.assets.find(asset => asset.id === finding.assetId)?.criticality || 'unset'} scoped={scoped}
                update={findingUpdates[finding.id] || initialUpdate(finding)} {...actions} showRelatedSignals={false} />)}</div>
        </details>}
    </article>
}

export function FindingCard({ finding, scoped, criticality, update, showRelatedSignals = true, ...actions }: FindingCardSharedProps & {
    finding: UvmFinding
    scoped: boolean
    criticality: UvmAssetCriticality
    update: UvmFindingUpdate
    showRelatedSignals?: boolean
}) {
    const { busy, setFindingUpdates, findingTriageHistoryAction, onViewRun } = actions
    const evidence = finding.observedInRun?.evidence || finding.evidence
    return <article className='rounded-md border border-ui-border bg-ui-raised p-3'>
        <div className='flex flex-wrap items-start justify-between gap-2'>
            <div>
                <div className='flex flex-wrap items-center gap-2'><strong>{finding.title}</strong><span className='rounded bg-ui-warning/15 px-2 py-0.5 text-[11px] font-semibold text-ui-warning'>{finding.severity}</span>{criticality !== 'unset' && <span className='rounded border border-ui-border px-2 py-0.5 text-[11px] text-ui-muted'>Asset {criticality}</span>}<span className='text-xs text-ui-muted'>{finding.engine}</span></div>
                <p className='mt-1 text-xs text-ui-muted'>{finding.asset}{finding.address ? ` · ${finding.address}` : ''}{finding.affectedLocation ? ` · ${finding.affectedLocation}` : ''}{finding.cveIds.length ? ` · ${finding.cveIds.join(', ')}` : ''}{finding.cvssScore !== null ? ` · CVSS ${finding.cvssScore}` : ''}</p>
            </div>
            <span className='flex items-center gap-2 text-xs font-semibold'>{finding.status.replaceAll('_', ' ')}<UvmHelp label='Remediation plan' text={`Owner/team is a free-form label. Due dates do not change severity; findings resolve only after eligible scan evidence.${scoped ? ' Edits apply to this organization-wide finding across assessments.' : ''}`} /></span>
        </div>
        {showRelatedSignals && finding.relatedSignals?.length ? <details className='mt-2 text-xs'>
            <summary className='cursor-pointer text-ui-muted'>Possible matches from other engines (showing up to 5)</summary>
            <p className='mt-1 text-ui-muted'>Same asset, CVE and network endpoint. Review before treating these as one issue; records stay separate.</p>
            <ul className='mt-1 grid gap-1'>{finding.relatedSignals.map(signal => <li key={signal.id} className='rounded border border-ui-border px-2 py-1'>
                <strong>{signal.engine}</strong> · {signal.title} · {signal.affectedLocation} · {signal.sharedCveIds.join(', ')} · {signal.status.replaceAll('_', ' ')}
            </li>)}</ul>
        </details> : null}
        {finding.description && <details className='mt-2 text-sm'><summary className='cursor-pointer text-ui-muted'>Description</summary><p className='mt-1'>{finding.description}</p></details>}
        {finding.solution && <details className='mt-2 text-sm'><summary className='cursor-pointer text-ui-muted'>Suggested fix</summary><p className='mt-1'>{finding.solution}</p></details>}
        {evidence && <details className='mt-2 text-xs'><summary className='cursor-pointer text-ui-muted'>Scanner evidence{finding.observedInRun ? ` · observed ${formatDate(finding.observedInRun.observedAt)}` : ''}</summary><pre className='mt-1 whitespace-pre-wrap wrap-break-word'>{evidence}</pre></details>}
        {(finding.remediationOwner || finding.remediationDueDate) && <p className='mt-2 text-xs text-ui-muted'>Owner/team: {finding.remediationOwner || 'Unassigned'}{finding.remediationDueDate ? ` · Due ${finding.remediationDueDate}` : ''}</p>}
        {finding.status !== 'resolved' && <div className='mt-3 flex flex-wrap items-end gap-2'>
            <details className='w-full rounded-md border border-ui-border px-2 py-1 text-xs'>
                <summary className='cursor-pointer text-ui-muted'>Edit remediation plan</summary>
                <div className='mt-2 grid gap-2 sm:grid-cols-2'>
                    <label className='grid gap-1 text-[11px] text-ui-muted'>Owner or team<input type='text' value={update.remediationOwner} maxLength={120} onChange={event => setFindingUpdates(current => ({ ...current, [finding.id]: { ...update, remediationOwner: event.target.value } }))} placeholder='Team or person' className='h-8 rounded-md border border-ui-border bg-ui-canvas px-2 text-xs text-ui-text' /></label>
                    <label className='grid gap-1 text-[11px] text-ui-muted'>Due date<input type='date' value={update.remediationDueDate} onChange={event => setFindingUpdates(current => ({ ...current, [finding.id]: { ...update, remediationDueDate: event.target.value } }))} className='h-8 rounded-md border border-ui-border bg-ui-canvas px-2 text-xs text-ui-text' /></label>
                </div>
            </details>
            <label className='grid gap-1 text-[11px] text-ui-muted'>Status<select value={update.status} onChange={event => setFindingUpdates(current => ({ ...current, [finding.id]: { ...update, status: event.target.value as UvmFinding['status'] } }))} className='h-8 rounded-md border border-ui-border bg-ui-canvas px-2 text-xs text-ui-text'><option value='needs_review'>Needs review</option><option value='open'>Open</option><option value='in_progress'>In progress</option><option value='pending_verification'>Pending verification</option><option value='accepted_risk'>Accepted risk</option><option value='false_positive'>False positive</option></select></label>
            <label className='grid min-w-52 flex-1 gap-1 text-[11px] text-ui-muted'>Triage note<input value={update.note} onChange={event => setFindingUpdates(current => ({ ...current, [finding.id]: { ...update, note: event.target.value } }))} maxLength={2000} placeholder='Reason or remediation context' className='h-8 rounded-md border border-ui-border bg-ui-canvas px-2 text-xs text-ui-text' /></label>
            <button type='button' onClick={() => actions.onUpdate(finding)} disabled={busy === `finding:${finding.id}`} className='h-8 rounded-md border border-ui-border px-3 text-xs font-semibold disabled:opacity-50'>{busy === `finding:${finding.id}` ? 'Saving…' : 'Save changes'}</button>
        </div>}
        <FindingTriageHistory findingId={finding.id} findingTitle={finding.title} findingUpdatedAt={finding.updatedAt} scoped={scoped} action={findingTriageHistoryAction} onViewRun={onViewRun} />
        {finding.status === 'needs_review' && <p className='mt-2 text-xs text-ui-muted'>Unvalidated scanner evidence. Review the evidence before promoting it to an open finding.</p>}
        {finding.status === 'pending_verification' && <p className='mt-2 text-xs text-ui-muted'>This finding will resolve after a later successful scan confirms it is no longer present.</p>}
        <p className='mt-2 text-[11px] text-ui-muted'>{finding.observationCount ? `Observed in ${finding.observationCount} run${finding.observationCount === 1 ? '' : 's'} overall · ` : ''}First seen {formatDate(finding.firstSeen)} · Last seen {formatDate(finding.lastSeen)}</p>
    </article>
}

function initialUpdate(finding: UvmFinding): UvmFindingUpdate {
    return { status: finding.status, note: finding.triageNote || '', remediationOwner: finding.remediationOwner || '', remediationDueDate: finding.remediationDueDate || '' }
}

function FindingTriageHistory({ findingId, findingTitle, findingUpdatedAt, scoped, action, onViewRun }: {
    findingId: string
    findingTitle: string
    findingUpdatedAt: string
    scoped: boolean
    action: FindingCardSharedProps['findingTriageHistoryAction']
    onViewRun: FindingCardSharedProps['onViewRun']
}) {
    const [open, setOpen] = useState(false)
    const [loadedAt, setLoadedAt] = useState<string | null>(null)
    const [entries, setEntries] = useState<UvmFindingTriageHistoryPage['entries']>([])
    const [nextCursor, setNextCursor] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [failedRequest, setFailedRequest] = useState<{ cursor: string | null, replace: boolean } | null>(null)
    const loadRef = useRef(false)
    const loadPage = useCallback(async (cursor: string | null, replace: boolean) => {
        if (loadRef.current) return
        loadRef.current = true
        setLoading(true)
        setError('')
        try {
            const page = await action(findingId, cursor)
            setFailedRequest(null)
            setEntries(current => {
                if (replace) return page.entries
                const ids = new Set(current.map(entry => entry.id))
                return [...current, ...page.entries.filter(entry => !ids.has(entry.id))]
            })
            setNextCursor(page.nextCursor)
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : 'Triage history could not be loaded.')
            setFailedRequest({ cursor, replace })
        } finally {
            if (replace) setLoadedAt(findingUpdatedAt)
            loadRef.current = false
            setLoading(false)
        }
    }, [action, findingId, findingUpdatedAt])
    useEffect(() => {
        if (open && loadedAt !== findingUpdatedAt) void loadPage(null, true)
    }, [open, loadedAt, findingUpdatedAt, loadPage])
    return <details className='mt-3 border-t border-ui-border pt-2 text-xs' onToggle={event => setOpen(event.currentTarget.open)}>
        <summary aria-label={`Triage history for ${findingTitle}`} className='cursor-pointer text-ui-muted'>Triage history</summary>
        {scoped && <p className='mt-1 text-ui-muted'>History spans this finding across assessments.</p>}
        {loading && <p role='status' className='mt-2 text-ui-muted'>Loading history…</p>}
        {error && <div className='mt-2 flex items-center gap-2 text-ui-warning'><p role='status'>{error}</p><button type='button' onClick={() => void loadPage(failedRequest?.cursor ?? null, failedRequest?.replace ?? true)} disabled={loading} className='rounded border border-ui-border px-2 py-1 font-semibold disabled:opacity-50'>Retry</button></div>}
        {!loading && !error && loadedAt === findingUpdatedAt && entries.length === 0 && <p role='status' className='mt-2 text-ui-muted'>No triage changes recorded.</p>}
        {entries.length > 0 && <ol className='mt-2 grid gap-2'>{entries.map(entry => <li key={entry.id} className='rounded border border-ui-border px-2 py-2'>
            <div className='flex flex-wrap items-center justify-between gap-2'><strong>{entry.status.replaceAll('_', ' ')}</strong><time dateTime={entry.createdAt} className='text-ui-muted'>{formatDate(entry.createdAt)}</time></div>
            <p className='mt-1 text-ui-muted'>Changed by: {entry.sourceRunId ? 'Scanner' : entry.actorId ? <span title={entry.actorId}>Account · {entry.actorId.slice(0, 8)}</span> : 'Not recorded'}</p>
            {entry.sourceRunId && entry.sourceEngine && <div className='mt-1 flex flex-wrap items-center gap-2 text-ui-muted'><span>Scan evidence · {entry.sourceEngine}</span><button type='button' aria-label={`View ${entry.sourceEngine} run from ${formatDate(entry.createdAt)}`} onClick={() => onViewRun(entry.sourceRunId!, entry.sourceEngine!)} className='rounded border border-ui-border px-2 py-1 font-semibold text-ui-text'>View run</button></div>}
            {entry.remediationPlanRecorded ? <p className='mt-1 text-ui-muted'>Owner/team: {entry.remediationOwner || 'Unassigned'} · Due date: {entry.remediationDueDate || 'None'}</p> : <p className='mt-1 text-ui-muted'>Remediation plan: Not recorded</p>}
            {entry.note && <details className='mt-1'><summary className='cursor-pointer text-ui-muted'>Note</summary><p className='mt-1 whitespace-pre-wrap'>{entry.note}</p></details>}
        </li>)}</ol>}
        {nextCursor && <button type='button' onClick={() => void loadPage(nextCursor, false)} disabled={loading} className='mt-2 rounded border border-ui-border px-2 py-1 font-semibold disabled:opacity-50'>{loading ? 'Loading…' : 'Load older history'}</button>}
    </details>
}
