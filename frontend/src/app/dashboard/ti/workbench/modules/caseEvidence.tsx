import type { AlertDetailPayload, CaseEvidence, CaseWatchlist, WorkbenchOrgContext } from '../types'
import { sourceProfileHref, watchlistLedgerHref } from './caseRoutes'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { safeWorkbenchDetail } from './copy'
import { relativeTime, customerOperationalText, workflowStatusClass, label } from './presentation'

export function AlertEvidenceRows({ evidence }: { evidence: NonNullable<NonNullable<AlertDetailPayload['alert']>['evidence']> }) {
    return (
        <div className='rounded-lg border border-ui-border bg-ui-raised p-3'>
            <h4 className='text-sm font-semibold text-ui-text'>Alert evidence</h4>
            <div className='mt-3 grid gap-2'>
                {evidence.map((item, index) => {
                    const provenance = typeof item.provenance === 'string'
                        ? item.provenance
                        : [item.provenance?.sourceId, item.provenance?.captureId, item.provenance?.captureMode].filter(Boolean).join(' · ')
                    const sourceHref = typeof item.provenance === 'object' && item.provenance?.sourceId ? sourceProfileHref(item.provenance.sourceId) : undefined
                    return (
                        <div key={item.id || `${item.contentHash || 'alert-evidence'}:${index}`} className='rounded-lg border border-ui-border bg-ui-panel p-3'>
                            <div className='flex flex-wrap items-center gap-2'>
                                <span className='text-sm font-semibold text-ui-text'>{item.sourceName || item.sourceFamily || item.id || 'source evidence'}</span>
                                {item.redactionState && <span className='rounded-full bg-ui-raised px-2 py-0.5 text-[11px] font-semibold text-ui-primary'>{String(item.redactionState).replaceAll('_', ' ')}</span>}
                                {item.captureMode && <span className='rounded-full bg-ui-panel px-2 py-0.5 text-[11px] font-semibold text-ui-muted'>{String(item.captureMode).replaceAll('_', ' ')}</span>}
                                {sourceHref ? (
                                    <Link href={sourceHref} className='inline-flex min-h-7 items-center gap-1 rounded-lg border border-ui-border bg-ui-panel px-2 py-0.5 text-[11px] font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/35'>
                                        Open source
                                        <ExternalLink className='h-3 w-3' />
                                    </Link>
                                ) : null}
                            </div>
                            <p className='mt-2 text-xs leading-5 text-ui-muted'>{safeWorkbenchDetail(item.excerpt)}</p>
                            <div className='mt-2 grid gap-1 text-xs text-ui-muted'>
                                <p><span className='font-semibold text-ui-muted'>Observed:</span> {item.observedAt || item.firstSeenAt ? relativeTime(item.observedAt || item.firstSeenAt || '') : 'checking'}</p>
                                <p className='break-all'><span className='font-semibold text-ui-muted'>Source details:</span> {customerOperationalText(provenance || 'syncing')}</p>
                            </div>
                            <p className='mt-2 break-all font-mono text-[11px] text-ui-muted'>{item.contentHash || item.id || 'content hash pending'}</p>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

export function CaseEvidenceRows({ evidence }: { evidence: CaseEvidence[] }) {
    return (
        <div className='rounded-lg border border-ui-border bg-ui-raised p-3'>
            <h4 className='text-sm font-semibold text-ui-text'>Case evidence</h4>
            <div className='mt-3 grid gap-2'>
                {evidence.map(item => (
                    <div key={item.id} className='rounded-lg border border-ui-border bg-ui-panel p-3'>
                        <div className='flex flex-wrap items-center gap-2'>
                            <span className='text-sm font-semibold text-ui-text'>{item.sourceName || item.id}</span>
                            {item.redactionState && <span className='rounded-full bg-ui-raised px-2 py-0.5 text-[11px] font-semibold text-ui-primary'>{String(item.redactionState).replaceAll('_', ' ')}</span>}
                        </div>
                        <p className='mt-2 text-xs leading-5 text-ui-muted'>{safeWorkbenchDetail(item.excerpt)}</p>
                        <p className='mt-2 break-all font-mono text-[11px] text-ui-muted'>{item.contentHash || item.id}</p>
                    </div>
                ))}
                {!evidence.length && <p className='text-xs text-ui-muted'>Evidence stream updates with the next normalized capture.</p>}
            </div>
        </div>
    )
}

export function CaseWatchlistRows({ watchlists, orgContext }: { watchlists: CaseWatchlist[], orgContext?: WorkbenchOrgContext }) {
    return (
        <div className='rounded-lg border border-ui-border bg-ui-raised p-3'>
            <div className='flex flex-wrap items-start justify-between gap-2 sm:items-center'>
                <h4 className='text-sm font-semibold text-ui-text'>Watchlist routing</h4>
                <Link href={watchlistLedgerHref(orgContext)} className='inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-ui-border bg-ui-panel px-2.5 py-1 text-xs font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/35'>
                    Open watchlists
                    <ExternalLink className='h-3.5 w-3.5' />
                </Link>
            </div>
            <div className='mt-3 grid gap-2'>
                {watchlists.map(watchlist => (
                    <div key={watchlist.id} className='rounded-lg border border-ui-border bg-ui-panel p-3'>
                        <div className='flex flex-wrap items-center gap-2'>
                            <span className='wrap-break-word text-sm font-semibold text-ui-text'>{watchlist.name || watchlist.id}</span>
                            <span className={workflowStatusClass(watchlist.status === 'active' ? 'ready' : 'needs_action')}>{label(watchlist.status)}</span>
                            {watchlist.hasWebhookUrl || watchlist.webhookDestinationId ? <span className='rounded-full bg-ui-raised px-2 py-0.5 text-[11px] font-semibold text-ui-primary'>delivery routed</span> : null}
                        </div>
                        <div className='mt-2 grid gap-1 text-xs text-ui-muted sm:grid-cols-2'>
                            <p><span className='font-semibold text-ui-muted'>Terms:</span> {watchlist.termCount ?? watchlist.matchedTerms?.length ?? 0}</p>
                            <p className='break-all'><span className='font-semibold text-ui-muted'>Destination:</span> {watchlist.webhookDestinationId || (watchlist.hasWebhookUrl ? 'watchlist webhook url' : 'syncing')}</p>
                            <p className='break-all sm:col-span-2'><span className='font-semibold text-ui-muted'>Matched:</span> {(watchlist.matchedTerms || []).map(term => `${term.kind || 'term'}:${term.value || 'syncing'}`).join(', ') || 'match stream is checking'}</p>
                        </div>
                    </div>
                ))}
                {!watchlists.length && <p className='text-xs leading-5 text-ui-muted'>Watchlist routing appears here when the case is tied to customer terms.</p>}
            </div>
        </div>
    )
}
