'use client'

import { useEffect, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { UvmAssetCriticality, UvmDashboard, UvmFinding, UvmFindingHistoryPage, UvmFindingUpdate } from '@/utils/monitoring/types'
import { formatDate, type UvmFindingFilters, type UvmFindingSort } from './uvmPanelHelpers'
import { UvmHelp } from './uvmPanelHelp'

type FindingsViewProps = {

    data: UvmDashboard
    attentionCount: number
    busy: string
    filters: UvmFindingFilters
    setFilters: Dispatch<SetStateAction<UvmFindingFilters>>
    sort: UvmFindingSort
    setSort: Dispatch<SetStateAction<UvmFindingSort>>
    visibleFindings: UvmFinding[]
    findingUpdates: Record<string, UvmFindingUpdate>
    setFindingUpdates: Dispatch<SetStateAction<Record<string, UvmFindingUpdate>>>
    onUpdate: (finding: UvmFinding) => void
    nextCursor: string | null
    loadOlder: (cursor: string | null) => Promise<UvmFindingHistoryPage>
    syncState?: UvmFindingHistoryPage['syncState']
    scoped: boolean
    onShowAll: () => void
    onRetryScoped: () => void
}

export function UvmFindingsView(props: FindingsViewProps) {
    const { data, attentionCount, busy, filters, setFilters, visibleFindings, findingUpdates, setFindingUpdates } = props
    const [cursor, setCursor] = useState(props.nextCursor)
    const [loadingOlder, setLoadingOlder] = useState(false)
    const [loadError, setLoadError] = useState('')
    useEffect(() => { setCursor(props.nextCursor) }, [props.nextCursor])
    return <section className='rounded-lg border border-ui-border bg-ui-panel p-4'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
            <h2 className='text-lg font-semibold'>Findings</h2>
            <div className='flex items-center gap-2'><UvmHelp label='Finding coverage' text='Findings retain their source, asset and evidence. An empty list does not mean an asset is clear if a scan is missing or partial.' /><UvmHelp label='Asset importance sort' text='Importance is set manually. It does not change scanner severity; unassigned assets appear last in this sort.' /><span className='rounded-full bg-ui-warning/15 px-2 py-1 text-xs font-semibold text-ui-warning'>{attentionCount} need attention{props.scoped ? ' loaded' : ''}</span></div>
        </div>
        {props.scoped && <div role='status' className='mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-ui-border bg-ui-raised p-3 text-sm'>
            <p className='text-ui-muted'>{props.syncState === 'pending' ? 'Scanner is indexing this assessment’s findings. Check again shortly.'
                : props.syncState === 'not_indexed' ? 'This engine’s report is available, but its output is not connected to cross-run triage yet.'
                    : props.syncState === 'incomplete' ? 'This stage has a scanner run, but it did not complete. Review its report output; incomplete results are not added to triage.'
                        : props.syncState === 'no_run' ? 'This assessment stage has no scanner run.'
                            : 'Showing findings recorded by this assessment stage, with their current triage status.'}</p>
            <div className='flex gap-2'><button type='button' onClick={props.onShowAll} disabled={Boolean(busy)} className='rounded border border-ui-border px-2 py-1 text-xs font-semibold disabled:opacity-50'>All findings</button>
                {props.syncState === 'pending' && <button type='button' onClick={props.onRetryScoped} disabled={Boolean(busy)} className='rounded border border-ui-border px-2 py-1 text-xs font-semibold disabled:opacity-50'>Check again</button>}</div>
        </div>}
        <div className='mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5'>
            <label className='grid gap-1 text-xs text-ui-muted sm:col-span-2 xl:col-span-1'>Search findings<input aria-label='Search findings' value={filters.query} onChange={event => setFilters(current => ({ ...current, query: event.target.value }))} placeholder='Title, asset, CVE…' className='h-9 rounded-md border border-ui-border bg-ui-canvas px-2 text-sm text-ui-text' /></label>
            <label className='grid gap-1 text-xs text-ui-muted'>Scanner<select aria-label='Filter by scanner' value={filters.engine} onChange={event => setFilters(current => ({ ...current, engine: event.target.value }))} className='h-9 rounded-md border border-ui-border bg-ui-canvas px-2 text-sm text-ui-text'><option value='all'>All scanners</option>{data.engines.map(engine => <option key={engine.id} value={engine.id}>{engine.name}</option>)}</select></label>
            <label className='grid gap-1 text-xs text-ui-muted'>Severity<select aria-label='Filter by severity' value={filters.severity} onChange={event => setFilters(current => ({ ...current, severity: event.target.value }))} className='h-9 rounded-md border border-ui-border bg-ui-canvas px-2 text-sm text-ui-text'><option value='all'>All severities</option>{['critical', 'high', 'medium', 'low', 'info', 'unknown'].map(severity => <option key={severity} value={severity}>{severity}</option>)}</select></label>
            <label className='grid gap-1 text-xs text-ui-muted'>Status<select aria-label='Filter by status' value={filters.status} onChange={event => setFilters(current => ({ ...current, status: event.target.value }))} className='h-9 rounded-md border border-ui-border bg-ui-canvas px-2 text-sm text-ui-text'><option value='needs_attention'>Needs attention</option><option value='needs_review'>Needs review</option><option value='all'>All statuses</option><option value='open'>Open</option><option value='in_progress'>In progress</option><option value='pending_verification'>Pending verification</option><option value='accepted_risk'>Accepted risk</option><option value='false_positive'>False positive</option><option value='resolved'>Resolved</option></select></label>
            <label className='grid gap-1 text-xs text-ui-muted'>Asset<select aria-label='Filter by asset' value={filters.asset} onChange={event => setFilters(current => ({ ...current, asset: event.target.value }))} className='h-9 rounded-md border border-ui-border bg-ui-canvas px-2 text-sm text-ui-text'><option value='all'>All assets</option>{[...new Map(data.findings.map(finding => [finding.assetId || finding.asset, finding.asset])).entries()].sort((left, right) => left[1].localeCompare(right[1])).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
            <label className='grid gap-1 text-xs text-ui-muted'>Sort by<select aria-label='Sort findings' value={props.sort} onChange={event => props.setSort(event.target.value as UvmFindingSort)} className='h-9 rounded-md border border-ui-border bg-ui-canvas px-2 text-sm text-ui-text'><option value='severity'>Severity, status, age</option><option value='criticality'>Asset importance, then severity</option></select></label>
        </div>
        <div className='mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-ui-muted'><p aria-live='polite'>{data.scannerError ? 'Finding counts unavailable' : `${visibleFindings.length} shown · ${data.findings.length} loaded`}</p><p>{props.sort === 'criticality' ? 'Asset importance first · unassigned last.' : 'Severity first.'}</p></div>
        <div className='mt-3 grid gap-3'>
            {visibleFindings.map(finding => <FindingCard key={finding.id} finding={finding} scoped={props.scoped} criticality={data.assets.find(asset => asset.id === finding.assetId)?.criticality || 'unset'} busy={busy} update={findingUpdates[finding.id] || {
                status: finding.status, note: finding.triageNote || '',
                remediationOwner: finding.remediationOwner || '', remediationDueDate: finding.remediationDueDate || '',
            }} setFindingUpdates={setFindingUpdates} onUpdate={() => props.onUpdate(finding)} />)}
            {!data.findings.length && <p className='rounded-md border border-ui-border bg-ui-raised p-4 text-sm text-ui-muted'>{data.scannerError ? 'Unavailable — Scanner data could not be loaded.' : props.scoped ? props.syncState === 'complete' ? 'No normalized findings were recorded for this assessment stage. Review the report and coverage before treating it as clear.' : props.syncState === 'not_indexed' ? 'This engine’s report is available above, but canonical findings are not yet available in triage.' : props.syncState === 'incomplete' ? 'This stage has a scanner run, but it did not complete. Its output remains in the assessment report.' : props.syncState === 'no_run' ? 'This assessment stage did not produce a scanner run.' : 'Findings for this stage have not been indexed yet.' : 'No findings imported. Check authorization, engine status and scan coverage before treating this as clear.'}</p>}
            {data.findings.length > 0 && !visibleFindings.length && <div className='rounded-md border border-ui-border bg-ui-raised p-4 text-sm text-ui-muted'><p>No findings match these filters.</p><button type='button' onClick={() => setFilters({ query: '', engine: 'all', severity: 'all', status: 'needs_attention', asset: 'all' })} className='mt-2 rounded-md border border-ui-border px-3 py-2 text-xs font-semibold text-ui-text'>Clear filters</button></div>}
        </div>
        {loadError && <p role='status' className='mt-3 text-sm text-ui-warning'>{loadError}</p>}
        {cursor && <button type='button' disabled={loadingOlder} onClick={() => {
            setLoadingOlder(true); setLoadError('')
            void props.loadOlder(cursor).then(result => setCursor(result.nextCursor))
                .catch(error => setLoadError(error instanceof Error ? error.message : 'Older findings could not be loaded.'))
                .finally(() => setLoadingOlder(false))
        }} className='mt-3 rounded-md border border-ui-border px-3 py-2 text-sm font-semibold disabled:opacity-50'>{loadingOlder ? 'Loading…' : 'Load older findings'}</button>}
    </section>
}

function FindingCard({ finding, scoped, criticality, busy, update, setFindingUpdates, onUpdate }: {
    finding: UvmFinding
    scoped: boolean
    criticality: UvmAssetCriticality
    busy: string
    update: UvmFindingUpdate
    setFindingUpdates: FindingsViewProps['setFindingUpdates']
    onUpdate: () => void
}) {
    const evidence = finding.observedInRun?.evidence || finding.evidence
    return <article className='rounded-md border border-ui-border bg-ui-raised p-3'>
        <div className='flex flex-wrap items-start justify-between gap-2'>
            <div>
                <div className='flex flex-wrap items-center gap-2'><strong>{finding.title}</strong><span className='rounded bg-ui-warning/15 px-2 py-0.5 text-[11px] font-semibold text-ui-warning'>{finding.severity}</span>{criticality !== 'unset' && <span className='rounded border border-ui-border px-2 py-0.5 text-[11px] text-ui-muted'>Asset {criticality}</span>}<span className='text-xs text-ui-muted'>{finding.engine}</span></div>
                <p className='mt-1 text-xs text-ui-muted'>{finding.asset}{finding.address ? ` · ${finding.address}` : ''}{finding.cveIds.length ? ` · ${finding.cveIds.join(', ')}` : ''}{finding.cvssScore !== null ? ` · CVSS ${finding.cvssScore}` : ''}</p>
            </div>
            <span className='flex items-center gap-2 text-xs font-semibold'>{finding.status.replaceAll('_', ' ')}<UvmHelp label='Remediation plan' text={`Owner/team is a free-form label. Due dates do not change severity; findings resolve only after eligible scan evidence.${scoped ? ' Edits apply to this organization-wide finding across assessments.' : ''}`} /></span>
        </div>
        {finding.relatedSignals?.length ? <details className='mt-2 text-xs'>
            <summary className='cursor-pointer text-ui-muted'>Possible matches from other engines (showing up to 5)</summary>
            <p className='mt-1 text-ui-muted'>Same asset and CVE; review before treating these as one issue.</p>
            <ul className='mt-1 grid gap-1'>
                {finding.relatedSignals.map(signal => <li key={signal.id} className='rounded border border-ui-border px-2 py-1'>
                    <strong>{signal.engine}</strong> · {signal.title} · {signal.sharedCveIds.join(', ')} · {signal.status.replaceAll('_', ' ')}
                </li>)}
            </ul>
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
            <button type='button' onClick={onUpdate} disabled={busy === `finding:${finding.id}`} className='h-8 rounded-md border border-ui-border px-3 text-xs font-semibold disabled:opacity-50'>{busy === `finding:${finding.id}` ? 'Saving…' : 'Save changes'}</button>
        </div>}
        {finding.status === 'needs_review' && <p className='mt-2 text-xs text-ui-muted'>Unvalidated scanner evidence. Review the evidence before promoting it to an open finding.</p>}
        {finding.status === 'pending_verification' && <p className='mt-2 text-xs text-ui-muted'>This finding will resolve after a later successful scan confirms it is no longer present.</p>}
        <p className='mt-2 text-[11px] text-ui-muted'>{finding.observationCount ? `Observed in ${finding.observationCount} run${finding.observationCount === 1 ? '' : 's'} overall · ` : ''}First seen {formatDate(finding.firstSeen)} · Last seen {formatDate(finding.lastSeen)}</p>
    </article>
}
