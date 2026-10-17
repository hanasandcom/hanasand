import { WatchlistItemRow } from './watchlistItemRow'
import type { WatchlistItem, AlertTerm, WatchlistKind, WatchlistSuggestion } from '../types/watchlists'
import type { OrganizationMember, OrganizationSummary } from '../types/organization'
import type { ScopedAlert, CollectionRequest, RowMessage, ActivitySubject } from '../types/activity'
import type { DeliveryRow } from '../types/delivery'
import { watchlistBusyLabel } from '../model/labels'
import { normalizeWatchlistValue, watchlistSearchText } from '../model/watchlists'
import { SectionTitle, InlineBusy, RowStatus, SelectField, Field, OrganizationMetadataBadge } from './shared'
import { secondaryButtonClass, primaryButtonClass, inputClass } from '../constants/styles'
import { OrganizationFilterStrip } from './filterStrip'
import { OrganizationCountBadges } from './organizationCountBadges'
import { watchlistTemplates, watchlistKinds } from '../constants/options'
import { useState } from 'react'
import { Archive, BellRing, RefreshCw } from 'lucide-react'
import { filterRowsByQueryAndStatus } from '../model/filterRows'

export function WatchlistPanel({ watchlists, activeTerms, members, canManage, canCleanup, busy, draft, setDraft, suggestions, editing, setEditing, onCreate, onSave, onAction, onDelete, organization, alerts, deliveries, onCleanup, onRefreshAlerts, onRequestFreshCollection, onRefreshCollectionStatus, collectionRequest, rowMessages, draftDuplicate, selectedSubject, onSelectSubject }: { watchlists: WatchlistItem[], activeTerms: AlertTerm[], members: OrganizationMember[], canManage: boolean, canCleanup: boolean, busy: string, draft: { kind: WatchlistKind, value: string, notes: string }, setDraft: (next: { kind: WatchlistKind, value: string, notes: string }) => void, suggestions: WatchlistSuggestion[], editing: Record<string, { kind: WatchlistKind, value: string, notes: string }>, setEditing: (next: Record<string, { kind: WatchlistKind, value: string, notes: string }> | ((current: Record<string, { kind: WatchlistKind, value: string, notes: string }>) => Record<string, { kind: WatchlistKind, value: string, notes: string }>)) => void, onCreate: () => void, onSave: (item: WatchlistItem) => void, onAction: (item: WatchlistItem, action: 'pause' | 'resume' | 'archive' | 'restore') => void, onDelete: (item: WatchlistItem) => void, organization: OrganizationSummary, alerts: ScopedAlert[], deliveries: DeliveryRow[], onCleanup: () => void, onRefreshAlerts: () => void, onRequestFreshCollection: () => void, onRefreshCollectionStatus: () => void, collectionRequest: CollectionRequest | null, rowMessages: Record<string, RowMessage>, draftDuplicate: boolean, selectedSubject: ActivitySubject, onSelectSubject: (subject: ActivitySubject) => void }) {
    const [watchlistQuery, setWatchlistQuery] = useState('')
    const [watchlistStatusFilter, setWatchlistStatusFilter] = useState('all')
    const activeCount = watchlists.filter(item => item.status.toLowerCase() === 'active').length
    const pausedCount = watchlists.filter(item => item.status.toLowerCase() === 'paused').length
    const archivedCount = watchlists.filter(item => item.status.toLowerCase() === 'archived').length
    const busyLabel = watchlistBusyLabel(busy)
    const normalizedWatchlistQuery = normalizeWatchlistValue(watchlistQuery)
    const visibleWatchlists = filterRowsByQueryAndStatus(watchlists, watchlistStatusFilter, normalizedWatchlistQuery, item => item.status, item => watchlistSearchText(item, organization))
    const filtersActive = Boolean(watchlistQuery.trim()) || watchlistStatusFilter !== 'all'
    return (
        <section id='watchlists' className='rounded-lg border border-ui-border bg-ui-panel p-4 shadow-sm dark:border-ui-border dark:bg-ui-panel'>
            <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                <SectionTitle icon={<BellRing className='h-4 w-4' />} title='Shared watchlists' detail='Customer-owned terms that drive events, cases, and delivery destinations.' />
                <div className='flex flex-wrap gap-2'>
                    <button type='button' className={secondaryButtonClass} disabled={!canManage || Boolean(busy) || activeTerms.length === 0} onClick={onRequestFreshCollection} title='Request a real source collection for the active organization watchlist terms'>
                        <RefreshCw className='h-4 w-4' />
                        Collect fresh evidence
                    </button>
                    <button type='button' className={secondaryButtonClass} disabled={!canManage || Boolean(busy) || activeTerms.length === 0} onClick={onRefreshAlerts} title='Rebuild events from already collected evidence'>
                        <RefreshCw className='h-4 w-4' />
                        Refresh events
                    </button>
                    <button type='button' className={secondaryButtonClass} disabled={!canCleanup || archivedCount === 0 || Boolean(busy)} onClick={onCleanup}>
                        <Archive className='h-4 w-4' />
                        Cleanup archived
                    </button>
                </div>
            </div>
            {watchlists.length > 0 && (
                <OrganizationCountBadges counts={[{ label: 'Active', count: activeCount }, { label: 'Paused', count: pausedCount }, { label: 'Archived', count: archivedCount }]} className='mt-3 flex flex-wrap gap-2' marker='data-org-watchlist-status-counts' />
            )}
            {busyLabel && <InlineBusy label={busyLabel} marker='data-org-watchlist-busy' />}
            <p className='text-xs leading-5 text-ui-muted'>Refresh checks the latest retained captures for these terms; it does not claim a new source collection run.</p>
            {collectionRequest && <div className='mt-2 flex flex-wrap items-center gap-2 rounded-md border border-ui-border bg-ui-raised px-3 py-2 text-xs dark:border-ui-border dark:bg-ui-canvas' data-org-collection-request='true'>
                <span className='font-semibold capitalize text-ui-text dark:text-ui-text'>Fresh collection: {collectionRequest.status}</span>
                <span className='text-ui-muted dark:text-ui-muted'>{collectionRequest.captureCount || 0} captures · {collectionRequest.alertCount || 0} events</span>
                {['queued', 'running'].includes(collectionRequest.status) && <button type='button' className='font-semibold text-ui-primary hover:underline' disabled={Boolean(busy)} onClick={onRefreshCollectionStatus}>Check status</button>}
                {collectionRequest.errors?.[0] && <span className='text-ui-text dark:text-ui-text'>{collectionRequest.errors[0]}</span>}
            </div>}
            <div className='mt-2'><RowStatus message={rowMessages['watchlists-cleanup']} /></div>
            <details id='org-watchlist-create' className='mt-4 overflow-hidden rounded-lg border border-ui-border bg-ui-raised dark:border-ui-border dark:bg-ui-canvas' data-org-watchlist-starter='true' data-org-watchlist-add-disclosure='true' open={watchlists.length === 0 ? true : undefined}>
                <summary className='flex min-h-12 cursor-pointer list-none flex-col gap-2 px-3 py-2 outline-none transition hover:bg-ui-panel focus-visible:ring-2 focus-visible:ring-ui-primary/25 dark:hover:bg-ui-panel sm:flex-row sm:items-center sm:justify-between [&::-webkit-details-marker]:hidden'>
                    <span className='flex min-w-0 flex-wrap items-center gap-2 text-sm font-semibold text-ui-text dark:text-ui-text'>
                        <span>Add shared term</span>
                        <span className='rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-xs font-semibold text-ui-muted dark:border-ui-border dark:bg-ui-panel dark:text-ui-muted'>{watchlists.length} saved</span>
                    </span>
                    <span className='text-xs font-semibold text-ui-primary dark:text-ui-primary'>Company, domain, vendor, actor</span>
                </summary>
                <div className='grid gap-3 border-t border-ui-border p-3 dark:border-ui-border'>
                    <div className='flex flex-wrap gap-2'>
                        {suggestions.map(suggestion => (
                            <button
                                key={suggestion.id}
                                type='button'
                                disabled={!canManage || suggestion.disabled || Boolean(busy)}
                                onClick={() => setDraft({ kind: suggestion.kind, value: suggestion.value, notes: suggestion.notes })}
                                className='inline-flex min-h-9 max-w-full items-center gap-2 rounded-md border border-ui-primary/35 bg-ui-primary/10 px-3 text-xs font-semibold text-ui-primary transition hover:bg-ui-primary/15 disabled:cursor-not-allowed disabled:border-ui-border disabled:bg-ui-panel disabled:text-ui-muted dark:border-ui-primary/35 dark:bg-ui-primary/10 dark:text-ui-primary dark:hover:bg-ui-primary/15 dark:disabled:border-ui-border dark:disabled:bg-ui-panel dark:disabled:text-ui-muted'
                                data-org-watchlist-suggestion='true'
                            >
                                <span className='truncate'>{suggestion.label}</span>
                                <span className='max-w-40 truncate font-mono'>{suggestion.value}</span>
                            </button>
                        ))}
                        {watchlistTemplates.map(template => (
                            <button
                                key={template.label}
                                type='button'
                                disabled={!canManage || Boolean(busy)}
                                onClick={() => setDraft({ kind: template.kind, value: '', notes: template.notes })}
                                className='inline-flex min-h-9 items-center rounded-md border border-ui-border bg-ui-panel px-3 text-xs font-semibold text-ui-on-primary transition hover:border-ui-primary/35 hover:bg-ui-primary/10 disabled:cursor-not-allowed disabled:opacity-55 dark:border-ui-border dark:bg-ui-panel dark:text-ui-on-primary dark:hover:bg-ui-raised'
                            >
                                {template.label}
                            </button>
                        ))}
                    </div>
                    <div className='grid gap-3 md:grid-cols-[9rem_1fr_auto]' data-org-watchlist-create-grid='true'>
                        <SelectField label='Type' value={draft.kind} options={watchlistKinds} disabled={!canManage} onChange={value => setDraft({ ...draft, kind: value as WatchlistKind })} />
                        <Field label='Term' value={draft.value} disabled={!canManage} onChange={value => setDraft({ ...draft, value })} placeholder='company.com, supplier, brand, actor' />
                        <div className='grid content-end'>
                            <button type='button' className={`${primaryButtonClass} whitespace-nowrap`} disabled={!canManage || !draft.value.trim() || draftDuplicate || Boolean(busy)} onClick={onCreate}>
                                <BellRing className='h-4 w-4' />
                                Add term
                            </button>
                        </div>
                        <label className='grid gap-1 text-sm font-medium text-ui-text dark:text-ui-muted md:col-span-3'>
                            Notes
                            <textarea value={draft.notes} disabled={!canManage} onChange={event => setDraft({ ...draft, notes: event.target.value })} className={`${inputClass} min-h-16 resize-y`} placeholder='Reason, owner, delivery context' />
                        </label>
                        {draftDuplicate && <p className='rounded-md bg-ui-warning/10 px-3 py-2 text-xs font-semibold text-ui-warning dark:bg-ui-warning/10 dark:text-ui-warning md:col-span-3'>This term already exists in this organization.</p>}
                        <div className='md:col-span-3'><RowStatus message={rowMessages['watchlist-create']} /></div>
                    </div>
                </div>
            </details>

            <div className='mt-5 grid gap-3'>
                {watchlists.length > 0 && (
                    <OrganizationFilterStrip
                        scope='watchlist'
                        searchLabel='Search terms'
                        query={watchlistQuery}
                        placeholder='Domain, supplier, owner, event ref'
                        onQueryChange={setWatchlistQuery}
                        selectLabel='Status'
                        selectedOption={watchlistStatusFilter}
                        options={['all', 'active', 'paused', 'archived']}
                        onSelectChange={setWatchlistStatusFilter}
                        visibleCount={visibleWatchlists.length}
                        totalCount={watchlists.length}
                        disabled={Boolean(busy)}
                        canClear={filtersActive}
                        onClear={() => {
                            setWatchlistQuery('')
                            setWatchlistStatusFilter('all')
                        }}
                    />
                )}
                {watchlists.length === 0 && (
                    <div className='flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-ui-primary/35 bg-ui-panel p-4 text-sm dark:border-ui-border dark:bg-ui-panel' data-org-watchlist-empty='true'>
                        <span className='font-semibold text-ui-text dark:text-ui-text'>No shared terms</span>
                        {watchlistKinds.slice(0, 4).map(kind => (
                            <OrganizationMetadataBadge key={kind}>{kind}</OrganizationMetadataBadge>
                        ))}
                        {canManage
                            ? <a href='#org-watchlist-create' className={secondaryButtonClass}>Add term</a>
                            : <span className={`${secondaryButtonClass} opacity-55`} aria-disabled='true'>Add term</span>}
                    </div>
                )}
                {watchlists.length > 0 && visibleWatchlists.length === 0 && (
                    <div className='rounded-lg border border-dashed border-ui-border bg-ui-panel p-4 text-sm text-ui-muted dark:border-ui-border dark:bg-ui-panel' data-org-watchlist-filter-empty='true'>
                        Adjust filters to see matching watchlist terms.
                    </div>
                )}
                {visibleWatchlists.map(item => <WatchlistItemRow key={item.id} item={item} watchlists={watchlists} activeTerms={activeTerms} members={members} canManage={canManage} busy={busy} editing={editing} setEditing={setEditing} onSave={onSave} onAction={onAction} onDelete={onDelete} organization={organization} alerts={alerts} deliveries={deliveries} rowMessages={rowMessages} selectedSubject={selectedSubject} onSelectSubject={onSelectSubject} />)}
            </div>

            <div className='mt-4 rounded-lg border border-ui-success/35 bg-ui-success/10 p-3 text-sm text-ui-success dark:border-ui-success/35 dark:bg-ui-success/10 dark:text-ui-success'>
                <strong>{activeTerms.length}</strong> active watch term{activeTerms.length === 1 ? '' : 's'} routing events for this organization.
            </div>
        </section>
    )
}
