import Link from 'next/link'
import { DashboardPanel } from '@/components/dashboard/ui'
import { evidenceStrengthLabel } from '@/utils/dwm/display'
import { formatTiDate, type TiAdminOverview } from '@/utils/tiAdmin/ops'
import type { TiEnrichmentOverview } from '@/utils/tiAdmin/enrichment'
import { operationalStateLabel, PanelTitle, StatusPill } from './dashboardPresentation'
import { actorProfileHref } from '@/utils/ti/actorProfileRoute'

export function RecentEvidencePanel({ captures }: { captures: TiAdminOverview['captures'] }) {
    return (
        <DashboardPanel className='overflow-hidden border-ui-border bg-ui-panel p-0'>
            <PanelTitle title='Recent evidence' actionHref='/ti/sources' actionLabel='Evidence' />
            <div className='overflow-x-auto'>
                <table className='min-w-full divide-y divide-ui-border text-sm'>
                    <thead className='bg-ui-canvas text-left text-xs font-semibold uppercase text-ui-muted'>
                        <tr>
                            <th className='px-4 py-3'>Capture</th>
                            <th className='px-4 py-3'>Actor</th>
                            <th className='px-4 py-3'>Source</th>
                            <th className='px-4 py-3'>Captured</th>
                        </tr>
                    </thead>
                    <tbody className='divide-y divide-ui-border bg-ui-panel'>
                        {captures.map(capture => (
                            <tr key={capture.id} className='hover:bg-ui-panel'>
                                <td className='px-4 py-4'>
                                    <Link
                                        href={`/ti/sources/${capture.sourceId}#${capture.id}`}
                                        className='font-semibold text-ui-text hover:text-ui-primary'
                                    >
                                        {capture.title}
                                    </Link>
                                    <p className='mt-1 text-xs text-ui-muted'>{capture.domain}</p>
                                </td>
                                <td className='px-4 py-3 font-semibold text-ui-text'>{capture.actor}</td>
                                <td className='px-4 py-3 text-ui-muted'>{capture.sourceName}</td>
                                <td className='whitespace-nowrap px-4 py-3 text-ui-muted'>{formatTiDate(capture.capturedAt)}</td>
                            </tr>
                        ))}
                        {!captures.length ? (
                            <tr>
                                <td colSpan={4} className='px-4 py-8 text-center text-sm text-ui-muted'>
                                    Collectors are checking sources; accepted captures stream here.
                                </td>
                            </tr>
                        ) : null}
                    </tbody>
                </table>
            </div>
        </DashboardPanel>
    )
}

export function ActorEnrichmentPanel({ enrichment }: { enrichment: TiEnrichmentOverview }) {
    const actors = [...enrichment.updatedActors, ...enrichment.queuedActors].slice(0, 8)
    return (
        <DashboardPanel className='overflow-hidden border-ui-border bg-ui-panel p-0'>
            <PanelTitle title='Actors being enriched' actionHref='/ti/profiles' actionLabel='Enrichment' />
            <div className='overflow-x-auto'>
                <table className='min-w-full divide-y divide-ui-border text-sm'>
                    <thead className='bg-ui-canvas text-left text-xs font-semibold uppercase text-ui-muted'>
                        <tr>
                            <th className='px-4 py-3'>Actor</th>
                            <th className='px-4 py-3'>Status</th>
                            <th className='px-4 py-3'>Evidence strength</th>
                            <th className='px-4 py-3'>Sources</th>
                            <th className='px-4 py-3'>Last update</th>
                            <th className='px-4 py-3'>Next refresh</th>
                        </tr>
                    </thead>
                    <tbody className='divide-y divide-ui-border bg-ui-panel'>
                        {actors.map(actor => (
                            <tr key={`${actor.id}-${actor.status}`} className='hover:bg-ui-panel'>
                                <td className='px-4 py-4'>
                                    <Link href={actorProfileHref(actor.name)} className='font-semibold text-ui-text hover:text-ui-primary'>
                                        {actor.name}
                                    </Link>
                                    <p className='mt-1 text-xs text-ui-muted'>
                                        {actor.changedFields.length ? actor.changedFields.join(', ') : 'queued'}
                                    </p>
                                </td>
                                <td className='px-4 py-4'>
                                    <StatusPill
                                        label={operationalStateLabel(actor.status)}
                                        tone={actor.status === 'queued' ? 'neutral' : actor.status === 'review' ? 'watch' : 'ok'}
                                    />
                                </td>
                                <td className='px-4 py-3 font-semibold text-ui-text'>{evidenceStrengthLabel(actor.confidence)}</td>
                                <td className='px-4 py-3 text-ui-muted'>{actor.sourceLinks.length}</td>
                                <td className='whitespace-nowrap px-4 py-3 text-ui-muted'>{formatTiDate(actor.lastUpdatedAt)}</td>
                                <td className='whitespace-nowrap px-4 py-3 text-ui-muted'>{formatTiDate(actor.nextRefreshAt)}</td>
                            </tr>
                        ))}
                        {!enrichment.updatedActors.length && !enrichment.queuedActors.length ? (
                            <tr>
                                <td colSpan={6} className='px-4 py-8 text-center text-sm text-ui-muted'>
                                    Actor profiles are updating. New profile changes appear here.
                                </td>
                            </tr>
                        ) : null}
                    </tbody>
                </table>
            </div>
        </DashboardPanel>
    )
}
