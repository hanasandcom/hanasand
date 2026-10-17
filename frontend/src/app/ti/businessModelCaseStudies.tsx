import type { TiActorCaseStudyCatalog } from '@/utils/ti/search'
import { formatIsoDate } from '@/utils/date/formatIsoDate'

export const formatDate = (value: string) => formatIsoDate(value)

export function ActorCaseStudyIndex({ catalog }: { catalog: TiActorCaseStudyCatalog }) {
    const currentCase = catalog.cases[0]
    return (
        <section data-ti-actor-case-studies='true' className='mt-5 min-w-0 border-t border-ui-border pt-4 dark:border-ui-border'>
            <div className='flex min-w-0 flex-wrap items-end justify-between gap-3'>
                <div className='min-w-0'>
                    <h3 className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Reviewed actor case</h3>
                    <p className='mt-1 text-xs leading-5 text-ui-muted dark:text-ui-muted'>
                        Corpus-wide: {catalog.caseStudyCount} reviewed multi-category case stud{catalog.caseStudyCount === 1 ? 'y' : 'ies'} across {catalog.supportedActorCount} actors. {catalog.pendingFindingCount ?? 0} findings remain pending and are not counted.
                    </p>
                </div>
                <span className='text-[11px] font-semibold text-ui-muted dark:text-ui-muted'>
                    {catalog.actorClassCounts.ransomwareOrExtortion} ransomware/extortion · {catalog.actorClassCounts.aptOrIntrusionSet} APT/intrusion-set
                </span>
            </div>
            {currentCase ? (
                <div className='mt-3 min-w-0 border-t border-ui-border py-3 dark:border-ui-border'>
                    <div className='flex min-w-0 items-center justify-between gap-2'>
                        <span className='truncate text-sm font-semibold text-ui-text dark:text-ui-text'>{currentCase.actor}</span>
                        <span className='shrink-0 text-[11px] font-semibold text-ui-muted dark:text-ui-muted'>{currentCase.findingCount} evidence-backed findings</span>
                    </div>
                    <div className='mt-2 flex min-w-0 flex-wrap gap-1'>
                        {currentCase.categories.map(category => <span key={category} className='rounded-md bg-ui-raised px-1.5 py-0.5 text-[10px] font-semibold text-ui-muted dark:bg-ui-raised dark:text-ui-muted'>{caseCategoryLabel(category)}</span>)}
                    </div>
                    <p className='mt-2 text-[11px] text-ui-muted dark:text-ui-muted'>
                        {currentCase.sourceCount} independent source{currentCase.sourceCount === 1 ? '' : 's'} · {currentCase.evidenceCount} exact reviewed evidence record{currentCase.evidenceCount === 1 ? '' : 's'}
                        {currentCase.lastPublishedAt ? ` · last published ${formatDate(currentCase.lastPublishedAt)}` : ''}
                        {currentCase.lastCollectedAt ? ` · last collected ${formatDate(currentCase.lastCollectedAt)}` : ''}
                    </p>
                </div>
            ) : <p className='mt-3 text-sm text-ui-muted dark:text-ui-muted'>This actor has no current reviewed evidence in two separate analysis categories.</p>}
            <p className='mt-3 text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>{catalog.qualification}</p>
            {catalog.missingContexts.length ? <p className='mt-1 text-[11px] leading-5 text-ui-warning dark:text-ui-warning'>Not represented by current retained evidence: {catalog.missingContexts.join('; ')}.</p> : null}
        </section>
    )
}

function caseCategoryLabel(value: string) {
    return ({
        advertised_offering: 'Advertised offering',
        buyer_seller_communication: 'Buyer/seller communication',
        communication_channel: 'Communication channel',
        economic_outcome: 'Revenue/profitability',
        intermediary_communication: 'Intermediary',
        negotiation: 'Negotiation',
        operating_model: 'Operating model',
        payment: 'Payment',
        pricing: 'Pricing',
        publicity: 'Publicity',
    } as Record<string, string>)[value] ?? value.replaceAll('_', ' ')
}
