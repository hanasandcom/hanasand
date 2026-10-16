'use client'

import type { TiActionabilityModel } from '@/utils/ti/actionability'
import { decisionStepStatusClass } from '../pageModel'

type ActorIdentity = TiActionabilityModel['orgRelevance']['actorIdentity']
type EnrichmentGap = TiActionabilityModel['orgRelevance']['enrichmentGaps'][number]

export default function OrgActorIdentity({ identity, enrichmentGaps }: {
    identity: ActorIdentity
    enrichmentGaps: EnrichmentGap[]
}) {
    const needsReview = enrichmentGaps.some(gap => gap.code.startsWith('missing_actor') || gap.code.startsWith('missing_target'))

    return <div data-ti-org-actor-identity='true' className='mt-3 rounded-lg border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-raised'>
        <div className='flex flex-wrap items-start justify-between gap-2'>
            <div className='min-w-0'>
                <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Actor identity</p>
                <p className='mt-1 wrap-break-word text-xs font-semibold text-ui-text dark:text-ui-text'>{identity.canonicalName} · {identity.actorClass}</p>
                <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>
                    {identity.aliases.length ? identity.aliases.slice(0, 4).join(', ') : 'Aliases not attached'} · {identity.sectors.length} sector{identity.sectors.length === 1 ? '' : 's'} · {identity.regions.length} region{identity.regions.length === 1 ? '' : 's'}
                </p>
            </div>
            <span className={decisionStepStatusClass(needsReview ? 'review' : 'ready')}>
                {needsReview ? 'Review' : 'Ready'}
            </span>
        </div>
        <div className='mt-2 flex flex-wrap gap-1.5'>
            {[...identity.sectors.slice(0, 4), ...identity.regions.slice(0, 4)].map(value => (
                <span key={value} className='max-w-full wrap-break-word rounded-md bg-ui-primary/10 px-2 py-1 text-[11px] font-semibold text-ui-primary dark:bg-ui-primary/10 dark:text-ui-primary'>{value}</span>
            ))}
        </div>
    </div>
}
