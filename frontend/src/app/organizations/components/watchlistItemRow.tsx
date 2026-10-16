import type { WatchlistItem, AlertTerm, WatchlistKind } from '../types/watchlists'
import type { OrganizationMember, OrganizationSummary } from '../types/organization'
import type { ScopedAlert, RowMessage, ActivitySubject } from '../types/activity'
import type { DeliveryRow } from '../types/delivery'
import { isDuplicateWatchlistTerm, watchlistDraftChanged, activeTermForWatchlist, alertsForWatchlist, latestDeliveryForWatchlist, destinationConfigured } from '../model/watchlists'
import { StatusPill, ConfirmActionButton, RowStatus } from './shared'
import { organizationDisplayName, organizationMemberLabel, destinationDisplayState } from '../model/organization'
import { compactReference } from '../model/references'
import { sanitizeOrganizationDisplayCopy } from '../model/textSafety'
import { formatDate } from '../model/labels'
import { iconButtonClass } from '../constants/styles'
import { stopRowSelectionKeys } from '../model/keyboard'
import { WatchlistDestinationSummary } from './watchlistDestinationSummary'
import { Archive, CheckCircle2, Pause, Pencil, Play, Trash2 } from 'lucide-react'

type WatchlistDraft = { kind: WatchlistKind, value: string, notes: string }
type Editing = Record<string, WatchlistDraft>
type WatchlistRowProps = {
    item: WatchlistItem
    watchlists: WatchlistItem[]
    activeTerms: AlertTerm[]
    members: OrganizationMember[]
    canManage: boolean
    busy: string
    editing: Editing
    setEditing: (next: Editing | ((current: Editing) => Editing)) => void
    onSave: (item: WatchlistItem) => void
    onAction: (item: WatchlistItem, action: 'pause' | 'resume' | 'archive' | 'restore') => void
    onDelete: (item: WatchlistItem) => void
    organization: OrganizationSummary
    alerts: ScopedAlert[]
    deliveries: DeliveryRow[]
    rowMessages: Record<string, RowMessage>
    selectedSubject: ActivitySubject
    onSelectSubject: (subject: ActivitySubject) => void
}
export function WatchlistItemRow({ item, watchlists, activeTerms, members, canManage, busy, editing, setEditing, onSave, onAction, onDelete, organization, alerts, deliveries, rowMessages, selectedSubject, onSelectSubject }: WatchlistRowProps) {
const edit = editing[item.id]
const editDuplicate = edit ? isDuplicateWatchlistTerm(watchlists, edit.kind, edit.value, item.id) : false
const editChanged = edit ? watchlistDraftChanged(item, edit) : false
const activeAlertTerm = activeTermForWatchlist(item, activeTerms)
const status = item.status.toLowerCase()
const lifecycleLabel = status === 'active' ? 'Active routes' : status === 'paused' ? 'Paused excluded' : status === 'archived' ? 'Archived closed' : `${item.status} state`
const alertTermLabel = activeAlertTerm ? 'Event term active' : status === 'active' ? 'Event term pending' : 'Event term excluded'
const selected = selectedSubject.type === 'watchlist' && selectedSubject.id === item.id
    return (
                        <div
                            key={item.id}
                            role='button'
                            tabIndex={0}
                            aria-pressed={selected}
                            id={`watchlist-${encodeURIComponent(item.id)}`}
                            className={`rounded-lg border p-3 transition ${selected ? 'border-ui-primary/35 bg-ui-primary/10 dark:border-ui-primary/35 dark:bg-ui-panel' : 'border-ui-border dark:border-ui-border'}`}
                            onClick={() => onSelectSubject({ type: 'watchlist', id: item.id })}
                            onKeyDown={event => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault()
                                    onSelectSubject({ type: 'watchlist', id: item.id })
                                }
                            }}
                        >
                            {edit ? (
                                <div className='grid gap-3 md:grid-cols-[9rem_1fr]' onClick={event => event.stopPropagation()} onKeyDown={stopRowSelectionKeys}>
                                    <SelectField label='Type' value={edit.kind} options={watchlistKinds} disabled={!canManage || Boolean(busy)} onChange={value => setEditing(current => ({ ...current, [item.id]: { ...edit, kind: value as WatchlistKind } }))} />
                                    <Field label='Term' value={edit.value} disabled={!canManage || Boolean(busy)} onChange={value => setEditing(current => ({ ...current, [item.id]: { ...edit, value } }))} />
                                    <label className='grid gap-1 text-sm font-medium text-ui-text dark:text-ui-muted md:col-span-2'>
                                        Notes
                                        <textarea value={edit.notes} disabled={!canManage || Boolean(busy)} onChange={event => setEditing(current => ({ ...current, [item.id]: { ...edit, notes: event.target.value } }))} className={`${inputClass} min-h-20 resize-y`} />
                                    </label>
                                    {editDuplicate && <p className='rounded-md bg-ui-warning/10 px-3 py-2 text-xs font-semibold text-ui-warning dark:bg-ui-warning/10 dark:text-ui-warning md:col-span-2'>This term already exists in this organization.</p>}
                                    {!editDuplicate && !editChanged && <p className='rounded-md bg-ui-raised px-3 py-2 text-xs font-semibold text-ui-muted dark:bg-ui-canvas dark:text-ui-muted md:col-span-2'>Watchlist term is current.</p>}
                                    <div className='flex flex-wrap gap-2 md:col-span-2' onClick={event => event.stopPropagation()} onKeyDown={stopRowSelectionKeys}>
                                        <button type='button' className={primaryButtonClass} disabled={!canManage || !edit.value.trim() || editDuplicate || Boolean(busy)} onClick={() => onSave(item)}>
                                            <CheckCircle2 className='h-4 w-4' />
                                            {editChanged ? 'Save' : 'Sync'}
                                        </button>
                                        <button type='button' className={secondaryButtonClass} disabled={Boolean(busy)} onClick={() => setEditing(current => {
                                            const next = { ...current }
                                            delete next[item.id]
                                            return next
                                        })}>Cancel</button>
                                    </div>
                                </div>
                            ) : (
                                <div className='grid gap-3'>
                                    <div className='grid gap-3 2xl:grid-cols-[minmax(16rem,1fr)_minmax(17rem,0.8fr)_auto] 2xl:items-start' data-org-watchlist-row-layout='true'>
                                        <div className='min-w-0'>
                                            <div className='flex flex-wrap items-center gap-2'>
                                                <span className='rounded-md bg-ui-primary/10 px-2 py-1 text-xs font-semibold text-ui-primary dark:bg-ui-primary/10 dark:text-ui-primary'>{item.kind}</span>
                                                <StatusPill status={item.status} />
                                                <span className='rounded-full border border-ui-border px-2 py-0.5 text-xs font-semibold text-ui-muted dark:border-ui-border dark:text-ui-muted' data-org-watchlist-lifecycle='true'>
                                                    {lifecycleLabel}
                                                </span>
                                                <span className='rounded-full border border-ui-border px-2 py-0.5 text-xs font-semibold text-ui-muted dark:border-ui-border dark:text-ui-muted' data-org-watchlist-alert-term='true'>
                                                    {alertTermLabel}
                                                </span>
                                            </div>
                                            <p className='mt-2 line-clamp-2 wrap-break-word text-base font-semibold text-ui-text dark:text-ui-text'>{item.value}</p>
                                            <p className='mt-1 truncate text-xs text-ui-muted dark:text-ui-muted'>{item.notes || 'Add delivery context.'}</p>
                                            <div className='mt-2 grid gap-1 text-xs text-ui-muted dark:text-ui-muted sm:grid-cols-2'>
                                                <span className='truncate'>Org: {organizationDisplayName(organization)}</span>
                                                <span className='truncate'>Owner: {organizationMemberLabel(item.updatedBy || item.createdBy, members)}</span>
                                                <span className='truncate'>Ref: {compactReference(activeAlertTerm?.alertGenerationRef || item.alertGenerationRef || item.id, 'watch')}</span>
                                                <span className='truncate'>Events: {alertsForWatchlist(item, alerts).length}</span>
                                                {activeAlertTerm?.matchReason && <span className='truncate'>Match: {sanitizeOrganizationDisplayCopy(activeAlertTerm.matchReason)}</span>}
                                                {activeAlertTerm?.provenanceHash && <span className='truncate'>Provenance: {compactReference(activeAlertTerm.provenanceHash, 'hash')}</span>}
                                            </div>
                                        </div>
                                        <WatchlistDestinationSummary item={item} delivery={latestDeliveryForWatchlist(item, deliveries)} />
                                        <div className='flex flex-wrap gap-2' onClick={event => event.stopPropagation()} onKeyDown={stopRowSelectionKeys}>
                                            {canManage ? (
                                                <>
                                                    <button type='button' aria-label='Edit watchlist term' title='Edit watchlist term' className={iconButtonClass} disabled={Boolean(busy)} onClick={() => setEditing(current => ({ ...current, [item.id]: { kind: item.kind, value: item.value, notes: item.notes || '' } }))}>
                                                        <Pencil className='h-4 w-4' />
                                                    </button>
                                                    {status === 'active' && <button type='button' aria-label='Pause watchlist term' title='Pause watchlist term' className={iconButtonClass} disabled={Boolean(busy)} onClick={() => onAction(item, 'pause')}><Pause className='h-4 w-4' /></button>}
                                                    {status === 'paused' && <button type='button' aria-label='Resume watchlist term' title='Resume watchlist term' className={iconButtonClass} disabled={Boolean(busy)} onClick={() => onAction(item, 'resume')}><Play className='h-4 w-4' /></button>}
                                                    {status === 'archived' && <button type='button' aria-label='Restore watchlist term' title='Restore watchlist term' className={iconButtonClass} disabled={Boolean(busy)} onClick={() => onAction(item, 'restore')}><Archive className='h-4 w-4' /></button>}
                                                    {status !== 'archived' && <ConfirmActionButton ariaLabel='Archive watchlist term' disabled={Boolean(busy)} onConfirm={() => onDelete(item)} icon={<Trash2 className='h-4 w-4' />} />}
                                                </>
                                            ) : (
                                                <span className='inline-flex min-h-10 items-center rounded-lg border border-ui-border bg-ui-raised px-3 text-xs font-semibold text-ui-muted dark:border-ui-border dark:bg-ui-raised dark:text-ui-muted' aria-disabled='true' title='Editor access required' aria-label='Watchlist actions: Editor access required'>
                                                    Read-only
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <RowStatus message={rowMessages[`watchlist-${item.id}`]} />
                                </div>
                            )}
                        </div>
                    )
}
