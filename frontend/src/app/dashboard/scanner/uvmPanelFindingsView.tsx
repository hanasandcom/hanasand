'use client'

import { useEffect, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { UvmDashboard, UvmFinding, UvmFindingGroup, UvmFindingHistoryPage, UvmFindingTriageHistoryPage, UvmFindingUpdate } from '@/utils/monitoring/types'
import { type UvmFindingFilters, type UvmFindingSort } from './uvmPanelHelpers'
import { FindingCard, FindingGroupCard } from './uvmPanelFindingCards'
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
    visibleGroups: UvmFindingGroup[]
    findingUpdates: Record<string, UvmFindingUpdate>
    setFindingUpdates: Dispatch<SetStateAction<Record<string, UvmFindingUpdate>>>
    onUpdate: (finding: UvmFinding) => void
    nextCursor: string | null
    loadOlder: (cursor: string | null) => Promise<{ nextCursor: string | null }>
    findingTriageHistoryAction: (findingId: string, cursor: string | null) => Promise<UvmFindingTriageHistoryPage>
    onViewRun: (runId: string, engine: string) => void
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
            <div className='flex items-center gap-2'><UvmHelp label='Finding coverage' text='Findings retain their source, asset and evidence. An empty list does not mean an asset is clear if a scan is missing or partial.' /><UvmHelp label='Finding sort' text='Due-date order uses dates set on each finding; undated items come last. Ties use scanner severity, status, then age. Asset importance is set manually and does not change scanner severity.' /><span className='rounded-full bg-ui-warning/15 px-2 py-1 text-xs font-semibold text-ui-warning'>{attentionCount} need attention{props.scoped ? ' loaded' : ''}</span></div>
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
            <label className='grid gap-1 text-xs text-ui-muted'>Sort by<select aria-label='Sort findings' value={props.sort} onChange={event => props.setSort(event.target.value as UvmFindingSort)} className='h-9 rounded-md border border-ui-border bg-ui-canvas px-2 text-sm text-ui-text'><option value='severity'>Severity, status, age</option><option value='criticality'>Asset importance, then severity</option><option value='due-date'>Due date, severity, age</option></select></label>
        </div>
        <div className='mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-ui-muted'><p aria-live='polite'>{data.scannerError ? 'Finding counts unavailable' : props.scoped ? `${visibleFindings.length} shown · ${data.findings.length} source records loaded` : `${props.visibleGroups.length} issues shown · ${data.findingGroupSummary?.total ?? props.visibleGroups.length} total · ${data.findingGroupSummary?.correlated ?? 0} cross-engine matches`}</p><p>{props.sort === 'criticality' ? 'Asset importance first · unassigned last.' : props.sort === 'due-date' ? 'Earliest due date first · undated last.' : 'Severity first.'}</p></div>
        <div className='mt-3 grid gap-3'>
            {props.scoped && visibleFindings.map(finding => <FindingCard key={finding.id} finding={finding} scoped criticality={data.assets.find(asset => asset.id === finding.assetId)?.criticality || 'unset'} busy={busy} update={findingUpdates[finding.id] || {
                status: finding.status, note: finding.triageNote || '',
                remediationOwner: finding.remediationOwner || '', remediationDueDate: finding.remediationDueDate || '',
            }} setFindingUpdates={setFindingUpdates} findingTriageHistoryAction={props.findingTriageHistoryAction} onViewRun={props.onViewRun} onUpdate={() => props.onUpdate(finding)} />)}
            {!props.scoped && props.visibleGroups.map(group => group.correlated
                ? <FindingGroupCard key={group.id} group={group} filters={filters} data={data} scoped={false} busy={busy} findingUpdates={findingUpdates} setFindingUpdates={setFindingUpdates} findingTriageHistoryAction={props.findingTriageHistoryAction} onViewRun={props.onViewRun} onUpdate={props.onUpdate} />
                : group.members[0] ? <FindingCard key={group.id} finding={group.members[0]} scoped={false} criticality={data.assets.find(asset => asset.id === group.assetId)?.criticality || 'unset'} busy={busy} update={findingUpdates[group.members[0].id] || { status: group.members[0].status, note: group.members[0].triageNote || '', remediationOwner: group.members[0].remediationOwner || '', remediationDueDate: group.members[0].remediationDueDate || '' }} setFindingUpdates={setFindingUpdates} findingTriageHistoryAction={props.findingTriageHistoryAction} onViewRun={props.onViewRun} onUpdate={() => props.onUpdate(group.members[0])} /> : null)}
            {props.scoped && !data.findings.length && <p className='rounded-md border border-ui-border bg-ui-raised p-4 text-sm text-ui-muted'>{data.scannerError ? 'Unavailable — Scanner data could not be loaded.' : props.syncState === 'complete' ? 'No normalized findings were recorded for this assessment stage. Review the report and coverage before treating it as clear.' : props.syncState === 'not_indexed' ? 'This engine’s report is available above, but canonical findings are not yet available in triage.' : props.syncState === 'incomplete' ? 'This stage has a scanner run, but it did not complete. Its output remains in the assessment report.' : props.syncState === 'no_run' ? 'This assessment stage did not produce a scanner run.' : 'Findings for this stage have not been indexed yet.'}</p>}
            {!props.scoped && !props.visibleGroups.length && <p className='rounded-md border border-ui-border bg-ui-raised p-4 text-sm text-ui-muted'>{data.scannerError ? 'Unavailable — Scanner data could not be loaded.' : !data.findingGroupSummary?.total ? 'No findings imported. Check authorization, engine status and scan coverage before treating this as clear.' : 'No issues match these filters.'}</p>}
            {props.scoped && data.findings.length > 0 && !visibleFindings.length && <div className='rounded-md border border-ui-border bg-ui-raised p-4 text-sm text-ui-muted'><p>No findings match these filters.</p><button type='button' onClick={() => setFilters({ query: '', engine: 'all', severity: 'all', status: 'needs_attention', asset: 'all' })} className='mt-2 rounded-md border border-ui-border px-3 py-2 text-xs font-semibold text-ui-text'>Clear filters</button></div>}
            {!props.scoped && (data.findingGroupSummary?.total || 0) > 0 && !props.visibleGroups.length && <button type='button' onClick={() => setFilters({ query: '', engine: 'all', severity: 'all', status: 'needs_attention', asset: 'all' })} className='w-fit rounded-md border border-ui-border px-3 py-2 text-xs font-semibold text-ui-text'>Clear filters</button>}
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
