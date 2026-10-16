import { BellRing, Building2, Database, Filter, Globe2, Radar, Search, ShieldCheck } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { buildRouteMetadata } from '../../../seo'
import { fetchDarkwebSearch, fetchDarkwebStatus, formatDate, formatNumber, paramValue } from './indexData'
import { Badge, Breakdown, Input, Metric, ProductTile, RecordRow } from './indexComponents'
import type { DarkwebSearchResponse } from './indexTypes'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Exposure Source Map',
    description: 'Search monitored leak sites, company mentions, review states, and dark web monitoring details.',
    path: '/ti/darkweb/index',
    keywords: ['exposure source map', 'dark web index', 'company exposure monitoring'],
})

type DarkwebIndexPageProps = {
    searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function DarkwebIndexPage({ searchParams }: DarkwebIndexPageProps) {
    const params = await searchParams
    const query = paramValue(params?.q).trim()
    const category = paramValue(params?.category).trim()
    const legalTriage = paramValue(params?.legalTriage).trim()
    const network = paramValue(params?.network).trim()
    const reviewState = paramValue(params?.reviewState).trim()
    const filters = { query, category, legalTriage, network, reviewState }
    const [status, search] = await Promise.all([
        fetchDarkwebStatus(),
        fetchDarkwebSearch(filters),
    ])
    const statusIndex = status?.darkwebIndex ?? status?.status
    const records = search?.rows ?? []

    return (
        <main className='min-h-app-viewport w-full min-w-0 bg-ui-canvas px-4 py-8 text-ui-text md:px-8'>
            <div className='mx-auto grid w-full min-w-0 max-w-7xl grid-cols-[minmax(0,1fr)] gap-6'>
                <section className='grid gap-4 rounded-lg border border-ui-border bg-ui-panel p-5 shadow-sm lg:grid-cols-[1.2fr_0.8fr]'>
                    <div className='grid gap-3'>
                        <div className='flex flex-wrap items-center gap-2'>
                            <h1 className='text-3xl font-semibold text-ui-text md:text-4xl'>Exposure source map</h1>
                            <Badge tone='ok'>company alerts</Badge>
                            <Badge tone='watch'>leak sites</Badge>
                        </div>
                        <p className='max-w-4xl text-sm leading-6 text-ui-muted'>
                            Search monitored exposure sources, recent postings, and captured page summaries for company names, group names, posted dates, sectors, countries, and data descriptions. This is the working index behind fast customer notifications and customer-ready summaries.
                        </p>
                    </div>
                    <div className='grid min-w-0 gap-2 text-sm'>
                        <Metric icon={<Database className='h-4 w-4' />} label='Monitored sources' value={formatNumber(statusIndex?.monitoredSourceCount, 'Unavailable')} />
                        <Metric icon={<Search className='h-4 w-4' />} label='Indexed records' value={formatNumber(statusIndex?.indexedRecordCount, 'Unavailable')} />
                        <Metric icon={<ShieldCheck className='h-4 w-4' />} label='Matches' value={formatNumber(search?.count, records.length ? 'Matched' : 'No current match')} />
                        <Metric icon={<BellRing className='h-4 w-4' />} label='Latest record' value={formatDate(statusIndex?.latestRecordAt, 'No records')} />
                    </div>
                </section>

                <section className='grid gap-3 lg:grid-cols-3'>
                    <ProductTile
                        icon={<Radar className='h-4 w-4' />}
                        title='Source verification'
                        detail='Use public indexes as seeds, then verify fresh exposure-source changes directly where collection is approved.'
                    />
                    <ProductTile
                        icon={<Building2 className='h-4 w-4' />}
                        title='Company watchlists'
                        detail='Match customers, subsidiaries, vendors, domains, and brands against new exposure posts and captured page text.'
                    />
                    <ProductTile
                        icon={<Globe2 className='h-4 w-4' />}
                        title='Monitoring mix'
                        detail='Use public indexes as seed coverage, then track monitored source infrastructure and exposure records in one customer-ready map.'
                    />
                </section>

                <form className='grid min-w-0 gap-3 rounded-lg border border-ui-border bg-ui-panel p-4 shadow-sm' action='/ti/darkweb/index'>
                    <div className='grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-[1.2fr_0.7fr_0.7fr_0.7fr_auto] xl:items-end'>
                        <Input label='Search' name='q' defaultValue={query} placeholder='company, group, domain, sector...' />
                        <Input label='Network' name='network' defaultValue={network} placeholder='tor, i2p, clear web' />
                        <Input label='Review type' name='legalTriage' defaultValue={legalTriage} placeholder='approved, review' />
                        <Input label='Status' name='reviewState' defaultValue={reviewState} placeholder='ready, watching' />
                        <button className='inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-ui-primary px-4 text-sm font-semibold text-ui-on-primary transition hover:opacity-90'>
                            <Filter className='h-4 w-4' />
                            Find
                        </button>
                    </div>
                    <input type='hidden' name='category' value={category} />
                </form>

                <section className='grid gap-3'>
                    <div className='flex flex-wrap items-center justify-between gap-3'>
                        <h2 className='text-lg font-semibold text-ui-text'>Exposure activity</h2>
                        <p className='text-xs text-ui-muted'>{records.length} shown{search?.nextCursor ? ' · more available' : ''}</p>
                    </div>
                    {records.length ? (
                        <div className='overflow-hidden rounded-lg border border-ui-border bg-ui-panel shadow-sm'>
                            <div className='hidden grid-cols-[1fr_0.55fr_0.7fr_0.55fr_0.55fr] gap-3 border-b border-ui-border bg-ui-raised px-3 py-2 text-xs font-semibold uppercase text-ui-muted lg:grid'>
                                <span>Mention</span>
                                <span>Activity type</span>
                                <span>Review</span>
                                <span>Freshness</span>
                                <span>Last seen</span>
                            </div>
                            {records.map(record => <RecordRow key={record.id} record={record} />)}
                        </div>
                    ) : (
                        <div className='grid min-h-[28vh] place-items-center rounded-lg border border-ui-border bg-ui-panel px-5 py-10 text-center shadow-sm'>
                            <div className='grid max-w-xl gap-3'>
                                <Search className='mx-auto h-7 w-7 text-ui-primary' />
                                <h2 className='text-xl font-semibold text-ui-text'>
                                    {emptyStateTitle(search, query)}
                                </h2>
                                <p className='text-sm leading-6 text-ui-muted'>
                                    {emptyStateDescription(search, query)}
                                </p>
                                {search?.canonicalIdentity ? (
                                    <Link className='mx-auto text-sm font-semibold text-ui-primary underline-offset-4 hover:underline' href={search.canonicalIdentity.canonicalPath}>
                                        Open {search.canonicalIdentity.canonicalName} intelligence
                                    </Link>
                                ) : null}
                            </div>
                        </div>
                    )}
                </section>

                <section className='grid gap-4 lg:grid-cols-4'>
                    <Breakdown title='Networks' values={statusIndex?.counts?.byNetwork} />
                    <Breakdown title='Review type' values={statusIndex?.counts?.byLegalTriage} />
                    <Breakdown title='Freshness' values={statusIndex?.counts?.byLiveness} />
                    <Breakdown title='Status' values={statusIndex?.counts?.byReviewState} />
                </section>
            </div>
        </main>
    )
}

function emptyStateTitle(search: DarkwebSearchResponse | null, query: string) {
    if (search?.canonicalIdentity) {
        return `${search.canonicalIdentity.canonicalName} is known, but has no approved restricted-network records`
    }
    return query ? 'No matching activity in the current index' : 'Search company and actor activity'
}

function emptyStateDescription(search: DarkwebSearchResponse | null, query: string) {
    if (search?.canonicalIdentity) {
        return `The query resolves to ${search.canonicalIdentity.canonicalName} in threat intelligence. This index contains zero approved metadata-only restricted-network captures for the current filters.`
    }
    return query
        ? 'Try a broader company, group, sector, or domain. Alerts are useful when a watched term appears; empty searches stay quiet.'
        : 'Enter a company, group, domain, supplier, or sector to review monitored exposure records.'
}
