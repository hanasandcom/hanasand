import type { WorkbenchOrgContext, WorkbenchCase, CaseDetailState, WorkbenchDeliveryEvidence } from '../types'
import { suggestedWatchTerm, watchlistCoverage, inferTermKind } from './watchlistHelpers'
import { orgInviteDisabledReason, watchlistMutationDisabledReason } from './actionInputs'
import { workflowStatusClass, relativeTime } from './presentation'
import { OperatorRow, OperatorReadinessRows } from './operatorReadiness'
import { ProductReadinessPanel } from './readinessPanel'
import { InspectionNotice } from './inspection'
import { OrganizationInviteCard } from './OrganizationInviteCard'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'

export function OrgOperatingPanel({ orgContext, selected, caseDetail, actionDeliveries, busyAction, inviteEmail, inviteRole, embedded = false, onInviteEmailChange, onInviteRoleChange, onInvite, onCreateSharedWatchlistTerm, onUpdateWatchlist }: {
    orgContext?: WorkbenchOrgContext
    selected?: WorkbenchCase
    caseDetail?: CaseDetailState
    actionDeliveries: WorkbenchDeliveryEvidence[]
    busyAction: string | null
    inviteEmail: string
    inviteRole: string
    embedded?: boolean
    onInviteEmailChange: (value: string) => void
    onInviteRoleChange: (value: string) => void
    onInvite: () => void | Promise<void>
    onCreateSharedWatchlistTerm: () => void | Promise<void>
    onUpdateWatchlist: (input: { watchlist: WorkbenchOrgContext['watchlists'][number], terms?: Array<{ value: string, kind?: string }>, status?: string }) => void | Promise<void>
}) {
    const term = selected ? suggestedWatchTerm(selected) : ''
    const termCoverage = term ? watchlistCoverage(orgContext, term) : undefined
    const access = caseDetail?.status === 'ready' ? caseDetail.detail.access : undefined
    const visibility = access?.visibilityDecision
    const inviteBlockedReason = orgInviteDisabledReason(orgContext, caseDetail)
    const blockedReason = !orgContext
        ? 'Organization operating context is syncing to this console.'
        : orgContext.readiness.blockedReasons[0]
    const watchlistBlockedReason = watchlistMutationDisabledReason(orgContext, caseDetail)
    const canCreateTerm = Boolean(orgContext?.createWatchlistAction && term && !termCoverage?.covered && !watchlistBlockedReason)
    const activeWatchlists = (orgContext?.watchlists || []).filter(item => item.status === 'active')

    return (
        <section className={embedded ? 'bg-ui-panel' : 'rounded-lg border border-ui-border bg-ui-panel'}>
            {!embedded && (
                <div className='border-b border-ui-border px-4 py-3'>
                    <h3 className='text-sm font-semibold text-ui-text'>Org and shared watchlist</h3>
                    <p className='mt-0.5 text-xs text-ui-muted'>Member access, watch terms, and customer visibility for the selected case.</p>
                </div>
            )}
            <div className='grid gap-3 p-3'>
                <div className='grid gap-2 text-xs'>
                    <OperatorRow label='Org' value={orgContext?.organization ? `${orgContext.organization.name} · ${orgContext.organization.id}` : 'syncing'} tone={orgContext?.organization ? 'ready' : 'blocked'} />
                    <OperatorRow label='Members' value={`${orgContext?.readiness.activeMemberCount ?? 0} active · ${orgContext?.readiness.pendingInviteCount ?? 0} pending`} tone={orgContext?.readiness.activeMemberCount ? 'ready' : 'blocked'} />
                    <OperatorRow label='Watchlists' value={`${orgContext?.readiness.activeWatchlistCount ?? 0} active · ${orgContext?.readiness.termCount ?? 0} terms`} tone={orgContext?.readiness.activeWatchlistCount ? 'ready' : 'needs_action'} />
                    <OperatorReadinessRows orgContext={orgContext} selected={selected} caseDetail={caseDetail} actionDeliveries={actionDeliveries} />
                    <OperatorRow label='Visibility' value={visibility ? `${visibility.alertVisibilityPolicy} · ${visibility.allowed ? 'visible' : visibility.reason || 'syncing'}` : `${orgContext?.readiness.alertVisibilityPolicy || 'members'} policy`} tone={visibility?.allowed === false ? 'blocked' : 'ready'} />
                    <OperatorRow label='Case role' value={access?.role ? `${access.role}${access.readOnly ? ' · read only' : ' · can edit'}` : 'checking case access'} tone={access ? access.readOnly ? 'needs_action' : 'ready' : 'needs_action'} />
                </div>

                <ProductReadinessPanel orgContext={orgContext} />

                {blockedReason && (
                    <InspectionNotice tone='blocked' title='Syncing' body={blockedReason} />
                )}

                <OrganizationInviteCard
                    inviteEmail={inviteEmail}
                    inviteRole={inviteRole}
                    busyAction={busyAction}
                    inviteBlockedReason={inviteBlockedReason}
                    orgContext={orgContext}
                    onInviteEmailChange={onInviteEmailChange}
                    onInviteRoleChange={onInviteRoleChange}
                    onInvite={onInvite}
                />

                <div className='rounded-lg border border-ui-border bg-ui-raised p-3'>
                    <div className='flex flex-wrap items-start justify-between gap-2 sm:items-center'>
                        <div>
                            <p className='text-xs font-semibold uppercase text-ui-muted'>Active members</p>
                            <p className='mt-1 text-xs leading-5 text-ui-muted'>Assignable people for this case.</p>
                        </div>
                        <span className={workflowStatusClass(orgContext?.members.length ? 'ready' : 'blocked')}>{orgContext?.members.length ? 'active' : 'syncing'}</span>
                    </div>
                    <div className='mt-3 grid gap-1'>
                        {(orgContext?.members || []).filter(member => member.status === 'active').slice(0, 5).map(member => (
                            <p key={member.id} className='truncate text-xs text-ui-muted'>{member.email} · {member.role}</p>
                        ))}
                        {!orgContext?.members.length && <p className='text-xs text-ui-muted'>Teammate state is loading; manual owner text stays available.</p>}
                    </div>
                </div>

                <div className='rounded-lg border border-ui-border bg-ui-raised p-3'>
                    <div className='flex flex-wrap items-start justify-between gap-2 sm:items-center'>
                        <div>
                            <p className='text-xs font-semibold uppercase text-ui-muted'>Selected term</p>
                            <p className='mt-1 break-all text-sm font-semibold text-ui-text'>{term || 'Term syncing'}</p>
                        </div>
                        <span className={workflowStatusClass(termCoverage?.covered ? 'ready' : canCreateTerm ? 'needs_action' : 'blocked')}>
                            {termCoverage?.covered ? 'covered' : canCreateTerm ? 'ready' : 'syncing'}
                        </span>
                    </div>
                    <p className='mt-2 text-xs leading-5 text-ui-muted'>
                        {termCoverage?.covered
                            ? `${term} is already in ${termCoverage.watchlistName}.`
                            : canCreateTerm
                                ? 'Create an active shared watchlist for this organization.'
                                : term ? 'Connect the organization watchlist before saving this term.' : 'Select a case with a matched term or evidence artifact before creating a shared watchlist entry.'}
                    </p>
                    <button
                        type='button'
                        disabled={!canCreateTerm || Boolean(busyAction)}
                        title={!canCreateTerm ? watchlistBlockedReason || blockedReason || 'Term is already covered or organization context is syncing.' : undefined}
                        onClick={onCreateSharedWatchlistTerm}
                        className='mt-3 inline-flex h-9 items-center rounded-lg border border-ui-border bg-ui-panel px-3 text-xs font-semibold text-ui-text transition hover:border-ui-border hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/20 disabled:cursor-not-allowed disabled:opacity-60'
                    >
                        {busyAction === `watchlist:${selected?.id}` ? 'Saving...' : 'Create shared term'}
                    </button>
                </div>

                <div className='rounded-lg border border-ui-border bg-ui-raised p-3'>
                    <div className='flex flex-wrap items-start justify-between gap-2 sm:items-center'>
                        <div>
                            <p className='text-xs font-semibold uppercase text-ui-muted'>Shared terms</p>
                            <p className='mt-1 text-xs leading-5 text-ui-muted'>Terms currently routing exposure matches into this customer scope.</p>
                        </div>
                        <span className={workflowStatusClass(activeWatchlists.length ? 'ready' : 'blocked')}>{activeWatchlists.length ? 'active' : 'syncing'}</span>
                    </div>
                    <div className='mt-3 grid gap-2'>
                        {activeWatchlists.slice(0, 3).map(watchlist => (
                            <div key={watchlist.id} className='rounded-lg border border-ui-border bg-ui-canvas p-2'>
                                <div className='flex items-center justify-between gap-2'>
                                    <p className='truncate text-xs font-semibold text-ui-text'>{watchlist.name}</p>
                                    <span className='text-[11px] text-ui-muted'>{relativeTime(watchlist.updatedAt)}</span>
                                </div>
                                <div className='mt-2 flex flex-wrap gap-1'>
                                    {watchlist.terms.slice(0, 6).map(termItem => (
                                        <button
                                            key={`${watchlist.id}:${termItem.value}`}
                                            type='button'
                                            disabled={Boolean(watchlistBlockedReason) || Boolean(busyAction) || watchlist.terms.length <= 1}
                                            title={watchlist.terms.length <= 1 ? 'Pause the watchlist before removing its last term.' : watchlistBlockedReason || 'Remove this term from the shared watchlist.'}
                                            onClick={() => onUpdateWatchlist({ watchlist, terms: watchlist.terms.filter(candidate => candidate.value !== termItem.value) })}
                                            className='rounded-full border border-ui-border bg-ui-panel px-2 py-0.5 text-[11px] font-semibold text-ui-muted transition hover:border-ui-border hover:bg-ui-raised disabled:cursor-not-allowed disabled:opacity-60'
                                        >
                                            {termItem.kind || inferTermKind(termItem.value)}:{termItem.value}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    type='button'
                                    disabled={Boolean(watchlistBlockedReason) || Boolean(busyAction)}
                                    title={watchlistBlockedReason || 'Pause this shared watchlist.'}
                                    onClick={() => onUpdateWatchlist({ watchlist, status: 'paused' })}
                                    className='mt-2 inline-flex h-8 items-center rounded-lg border border-ui-border bg-ui-panel px-2.5 text-xs font-semibold text-ui-text transition hover:border-ui-border hover:bg-ui-raised disabled:cursor-not-allowed disabled:opacity-60'
                                >
                                    {busyAction === `watchlist:update:${watchlist.id}` ? 'Saving...' : 'Pause watchlist'}
                                </button>
                            </div>
                        ))}
                        {!activeWatchlists.length && <p className='text-xs leading-5 text-ui-muted'>Shared watchlist state is updating for the first active term.</p>}
                    </div>
                </div>

                {visibility?.allowed === false && (
                    <InspectionNotice
                        tone='blocked'
                        title='Case visibility blocked'
                        body={`Policy ${visibility.alertVisibilityPolicy} allows ${visibility.allowedRoles.join(', ')}. Current member needs access: ${visibility.reason || 'access is denied'}.`}
                    />
                )}

                <div className='grid gap-2'>
                    {orgContext?.links.map(link => (
                        <Link key={link.href} href={link.href} className='inline-flex h-8 items-center justify-between gap-2 rounded-lg border border-ui-border bg-ui-panel px-2.5 text-xs font-semibold text-ui-text transition hover:border-ui-border hover:bg-ui-raised'>
                            {link.label}
                            <ExternalLink className='h-3.5 w-3.5' />
                        </Link>
                    ))}
                </div>
            </div>
        </section>
    )
}
