import Link from 'next/link'
import { evidenceStrengthLabel } from '@/utils/dwm/display'
import { formatTiDate, type TiAdminOverview } from '@/utils/tiAdmin/ops'
import type { TiEnrichmentOverview } from '@/utils/tiAdmin/enrichment'
import { operationalStateLabel, StatusPill } from './dashboardPresentation'
import { actorProfileHref } from '@/utils/ti/actorProfileRoute'
import { TiAdminDataTable } from './TiAdminDataTable'

export function RecentEvidencePanel({ captures }: { captures: TiAdminOverview['captures'] }) {
    return (
        <TiAdminDataTable
            title='Recent evidence'
            actionHref='/ti/sources'
            actionLabel='Evidence'
            columns={['Capture', 'Actor', 'Source', 'Captured']}
        >
            {captures.map(capture => (
                <tr key={capture.id} className='hover:bg-ui-panel'>
                    <td className='px-4 py-4'>
                        <Link href={`/ti/sources/${capture.sourceId}#${capture.id}`} className='font-semibold text-ui-text hover:text-ui-primary'>
                            {capture.title}
                        </Link>
                        <p className='mt-1 text-xs text-ui-muted'>{capture.domain}</p>
                    </td>
                    <td className='px-4 py-3 font-semibold text-ui-text'>{capture.actor}</td>
                    <td className='px-4 py-3 text-ui-muted'>{capture.sourceName}</td>
                    <td className='whitespace-nowrap px-4 py-3 text-ui-muted'>{formatTiDate(capture.capturedAt)}</td>
                </tr>
            ))}
            {!captures.length ? <tr>
                <td colSpan={4} className='px-4 py-8 text-center text-sm text-ui-muted'>
                    Collectors are checking sources; accepted captures stream here.
                </td>
            </tr> : null}
        </TiAdminDataTable>
    )
}

export function ActorEnrichmentPanel({ enrichment }: { enrichment: TiEnrichmentOverview }) {
    const actors = [...enrichment.updatedActors, ...enrichment.queuedActors].slice(0, 8)
    return (
        <TiAdminDataTable
            title='Actors being enriched'
            actionHref='/ti/profiles'
            actionLabel='Enrichment'
            columns={['Actor', 'Status', 'Evidence strength', 'Sources', 'Last update', 'Next refresh']}
        >
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
            {!enrichment.updatedActors.length && !enrichment.queuedActors.length ? <tr>
                <td colSpan={6} className='px-4 py-8 text-center text-sm text-ui-muted'>
                    Actor profiles are updating. New profile changes appear here.
                </td>
            </tr> : null}
        </TiAdminDataTable>
    )
}
