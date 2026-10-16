'use client'
import type { WorkbenchCase, WorkbenchOrgContext } from './types'
import { useRouter } from 'next/navigation'
import { WorkbenchStat } from './modules/presentation'
import { AttackWelcome, EmptyWorkspace } from './modules/emptyStates'
import { Inbox, AlertTriangle, ShieldCheck, Activity, Clock3, ExternalLink } from 'lucide-react'
import { evidenceStrengthLabel } from '@/utils/dwm/display'
import { CaseDetail } from './modules/caseDetail'
import { OperatorActionRail } from './modules/operatorActionRail'
import Link from 'next/link'
import { useWorkbenchQueue } from './useWorkbenchQueue'
import { useWorkbenchDetails } from './useWorkbenchDetails'
import { useWorkbenchActionState } from './useWorkbenchActionState'
import { useAlertWorkflowActions } from './useAlertWorkflowActions'
import { useCaseWorkflowActions } from './useCaseWorkflowActions'
import { useOrganizationWorkflowActions } from './useOrganizationWorkflowActions'
import { OrgOperatingPanel } from './modules/OrgOperatingPanel'
import { WorkbenchQueuePanel } from './modules/WorkbenchQueuePanel'
export type { WorkbenchEvidence, WorkbenchTimelineItem, WorkbenchWorkflowStep, WorkbenchAction, WorkbenchHandoffAction, WorkbenchHandoffPayload, WorkbenchPublicTiHandoff, WorkbenchCaseMutationAction, WorkbenchCaseMutationPayload, WorkbenchInvitePayload, WorkbenchWatchlistUpsertPayload, WorkbenchDeliveryEvidence, WorkbenchKeyboardState, WorkbenchActionOutcome, WorkbenchReadinessEvidenceState, WorkbenchProductReadinessItem, WorkbenchOrgContext, WorkbenchCase, OperatorActionRailRow } from './types'

export default function AnalystWorkbenchClient({ initialCases, chrome = 'full', orgContext, initialSelectedId }: { initialCases: WorkbenchCase[], chrome?: 'full' | 'compact', orgContext?: WorkbenchOrgContext, initialSelectedId?: string }) {
    const router = useRouter()
    const compact = chrome === 'compact'
    const queue = useWorkbenchQueue(initialCases, initialSelectedId)
    const { setSelectedId, filter, setFilter, query, setQuery, notes, setNotes, ownerDrafts, setOwnerDrafts,
        inviteEmail, setInviteEmail, inviteRole, setInviteRole, localDecisions, setLocalDecisions,
        cases, selected, queues, workbenchStats, handleQueueKeyDown } = queue
    const actionState = useWorkbenchActionState(router)
    const { busyAction, message, setMessage, runPersistentAction } = actionState
    const details = useWorkbenchDetails(selected, orgContext)
    const { caseDetails, alertDetails, actionDeliveries, refreshCaseDetail, refreshBackedSelection } = details
    const selectedDecision = selected ? localDecisions[selected.id] : undefined
    const selectedCaseDetail = selected ? caseDetails[selected.id] : undefined
    const selectedAlertDetail = selected ? alertDetails[selected.id] : undefined
    const selectedActionDeliveries = selected ? actionDeliveries[selected.id] || [] : []
    const alertActions = useAlertWorkflowActions({ orgContext, alertDetails, localDecisions, setLocalDecisions, setMessage, runPersistentAction, refreshBackedSelection })
    const caseActions = useCaseWorkflowActions({ orgContext, setLocalDecisions, setMessage, runPersistentAction, refreshCaseDetail })
    const organizationActions = useOrganizationWorkflowActions({ orgContext, selectedCaseDetail, inviteEmail, setInviteEmail, inviteRole, runPersistentAction, setMessage })
    const { applyDecision, replayDwmAlert, sendDwmAlert, runWorkbenchAction } = alertActions
    const { copyHandoffPayload, runBackedCaseMutation, recordCustomerNotification } = caseActions
    const { createSharedWatchlistTerm, inviteOrganizationMember, upsertWatchlist } = organizationActions

    if (!initialCases.length) return <AttackWelcome />

    const workbenchStatsGrid = (
        <div className='grid grid-cols-2 gap-2 border-b border-ui-border bg-ui-canvas p-2 sm:p-3 xl:grid-cols-5' data-workbench-stats>
            <WorkbenchStat icon={<Inbox className='h-4 w-4' />} label='Open cases' value={String(workbenchStats.total)} detail={`${workbenchStats.review} awaiting analyst`} tone='neutral' />
            <WorkbenchStat icon={<AlertTriangle className='h-4 w-4' />} label='High priority' value={String(workbenchStats.highPriority)} detail='critical or high severity' tone={workbenchStats.highPriority ? 'warn' : 'good'} />
            <WorkbenchStat icon={<ShieldCheck className='h-4 w-4' />} label='Customer-ready' value={String(workbenchStats.persistent)} detail='saved alert workflows' tone={workbenchStats.persistent ? 'good' : 'neutral'} />
            <WorkbenchStat icon={<Activity className='h-4 w-4' />} label='Evidence' value={String(workbenchStats.evidence)} detail='cases with captured material' tone={workbenchStats.evidence ? 'good' : 'neutral'} />
            <WorkbenchStat icon={<Clock3 className='h-4 w-4' />} label='Newest update' value={workbenchStats.latest} detail='latest case refresh' tone='neutral' className='col-span-2 xl:col-span-1' />
        </div>
    )

    return (
        <div className='grid gap-3'>
            {message && (
                <p className={`rounded-lg border px-3 py-2 text-sm ${message.ok ? 'border-ui-success/35 bg-ui-success/10 text-ui-success' : 'border-ui-danger/35 bg-ui-raised/10 text-ui-text'}`}>
                    {message.text}
                </p>
            )}

            <div className='min-w-0 overflow-hidden rounded-lg border border-ui-border bg-ui-panel'>
                {compact ? (
                    <details className='border-b border-ui-border bg-ui-canvas' data-workbench-stats-disclosure>
                        <summary className='flex cursor-pointer list-none flex-col gap-1 px-4 py-3 text-sm font-semibold text-ui-text outline-none transition hover:bg-ui-panel focus-visible:ring-2 focus-visible:ring-ui-primary/20 sm:flex-row sm:items-center sm:justify-between [&::-webkit-details-marker]:hidden'>
                            <span>Attack summary</span>
                            <span className='text-xs font-medium text-ui-muted'>{workbenchStats.total} cases · {workbenchStats.highPriority} high · {workbenchStats.latest}</span>
                        </summary>
                        {workbenchStatsGrid}
                    </details>
                ) : workbenchStatsGrid}

                <div className={`grid min-w-0 ${compact ? 'min-h-[480px] xl:grid-cols-[280px_minmax(0,1fr)] 2xl:grid-cols-[300px_minmax(0,1fr)_280px]' : 'min-h-[480px] xl:grid-cols-[280px_minmax(0,1fr)] 2xl:grid-cols-[300px_minmax(0,1fr)_300px]'}`}>
                    <WorkbenchQueuePanel cases={cases} selected={selected} compact={compact} query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} setSelectedId={setSelectedId} onKeyDown={handleQueueKeyDown} />

                    <main className='min-w-0'>
                        {selected ? (
                            <CaseDetail
                                item={selected}
                                decision={selectedDecision}
                                note={notes[selected.id] ?? ''}
                                ownerDraft={ownerDrafts[selected.id]}
                                busyAction={busyAction}
                                compact={compact}
                                caseDetail={selectedCaseDetail}
                                alertDetail={selectedAlertDetail}
                                actionDeliveries={selectedActionDeliveries}
                                orgContext={orgContext}
                                actionMessage={message}
                                onNoteChange={value => setNotes(current => ({ ...current, [selected.id]: value }))}
                                onOwnerDraftChange={value => setOwnerDrafts(current => ({ ...current, [selected.id]: value }))}
                                onDecision={(decision) => applyDecision(selected, decision)}
                                onBackedCaseMutation={(mutation) => runBackedCaseMutation(selected, mutation)}
                                onCustomerNotification={() => recordCustomerNotification(selected, notes[selected.id] ?? '', selectedCaseDetail)}
                                onReplay={() => replayDwmAlert(selected)}
                                onSend={() => sendDwmAlert(selected)}
                            />
                        ) : (
                            <EmptyWorkspace />
                        )}
                    </main>

                    <aside className='min-w-0 border-t border-ui-border bg-ui-canvas xl:col-span-2 2xl:col-span-1 2xl:border-l 2xl:border-t-0'>
                        <div className='grid gap-4 p-4'>
                            <OperatorActionRail
                                selected={selected}
                                orgContext={orgContext}
                                caseDetail={selectedCaseDetail}
                                alertDetail={selectedAlertDetail}
                                actionDeliveries={selectedActionDeliveries}
                                note={selected ? notes[selected.id] ?? '' : ''}
                                busyAction={busyAction}
                                onRunAction={(action) => selected && runWorkbenchAction(selected, action, notes[selected.id] ?? '')}
                                onCustomerNotification={() => selected && recordCustomerNotification(selected, notes[selected.id] ?? '', selectedCaseDetail)}
                                onCopyPayload={(payload) => selected && copyHandoffPayload(selected, payload)}
                            />

                            <details className='rounded-lg border border-ui-border bg-ui-panel' data-workbench-org-disclosure>
                                <summary className='flex cursor-pointer list-none flex-col gap-1 px-4 py-3 text-sm font-semibold text-ui-text transition hover:bg-ui-raised sm:flex-row sm:items-center sm:justify-between [&::-webkit-details-marker]:hidden'>
                                    <span>Org and shared watchlist</span>
                                    <span className='text-xs font-medium text-ui-muted'>Members, terms, visibility</span>
                                </summary>
                                <div className='border-t border-ui-border'>
                                    <OrgOperatingPanel
                                        orgContext={orgContext}
                                        selected={selected}
                                        caseDetail={selectedCaseDetail}
                                        actionDeliveries={selectedActionDeliveries}
                                        busyAction={busyAction}
                                        inviteEmail={inviteEmail}
                                        inviteRole={inviteRole}
                                        embedded
                                        onInviteEmailChange={setInviteEmail}
                                        onInviteRoleChange={setInviteRole}
                                        onInvite={inviteOrganizationMember}
                                        onCreateSharedWatchlistTerm={() => selected && createSharedWatchlistTerm(selected)}
                                        onUpdateWatchlist={upsertWatchlist}
                                    />
                                </div>
                            </details>

                            <details className='rounded-lg border border-ui-border bg-ui-panel' data-workbench-case-groups-disclosure>
                                <summary className='flex cursor-pointer list-none flex-col gap-1 px-4 py-3 text-sm font-semibold text-ui-text transition hover:bg-ui-raised sm:flex-row sm:items-center sm:justify-between [&::-webkit-details-marker]:hidden'>
                                    <span>Case groups and links</span>
                                    <span className='text-xs font-medium text-ui-muted'>{queues.length} groups, {selected?.relatedLinks.length || 0} links</span>
                                </summary>
                                <div className='grid gap-2 border-t border-ui-border p-3'>
                                    {queues.map(queue => (
                                        <div key={queue.name} className='flex items-center justify-between gap-3 rounded-lg border border-ui-border bg-ui-raised px-3 py-2 text-xs'>
                                            <span className='font-semibold text-ui-text'>{queue.name}</span>
                                            <span className='text-ui-muted'>{queue.count}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className='grid gap-2 border-t border-ui-border p-3'>
                                    {selected?.relatedLinks.map(link => (
                                        <Link key={link.href} href={link.href} className='inline-flex h-9 items-center justify-between gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 text-xs font-semibold text-ui-on-primary transition hover:border-ui-border hover:bg-ui-primary/10'>
                                            {link.label}
                                            <ExternalLink className='h-3.5 w-3.5' />
                                        </Link>
                                    ))}
                                </div>
                            </details>
                        </div>
                    </aside>
                </div>
            </div>
        </div>
    )
}
