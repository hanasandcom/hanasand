import { pageNumber } from '@/utils/pagination'
import Link from 'next/link'
import { ArrowRight, PlayCircle } from 'lucide-react'
import { DashboardPage, DashboardPanel } from 'hanasand/dashboard'
import { getTiAdminOverview, getTiCollectionRunsPage } from '@/utils/tiAdmin/ops'
import TiDataAvailability from '../ti-data-availability'
import { RunActivityPanel } from './RunActivityPanel'
import { RunAttentionPanel } from './RunAttentionPanel'
import { RunSummary } from './RunSummary'
import { summarizeCollectionRuns } from './runSummaryModel'

export const dynamic = 'force-dynamic'

export default async function TiRunsPage(props: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
    // Collection operations belong to the global source fleet, not tenant watchlists.
    const params = await props.searchParams
    const page = pageNumber(params?.page)
    const [{ runs, total, available }, overview] = await Promise.all([
        getTiCollectionRunsPage(null, { page, limit: 50 }),
        getTiAdminOverview(null, { limit: 50, includeSamples: false, includeCandidates: true }),
    ])
    const { sources } = overview
    const summary = summarizeCollectionRuns(runs, sources)

    return <DashboardPage>
        <TiDataAvailability availability={overview.availability} />
        <RunSummary summary={summary} />

        {!available ? <DashboardPanel className='border-ui-danger/35 bg-ui-raised/5 p-4'>
            <p className='font-semibold text-ui-text'>Collection history unavailable</p>
            <p className='mt-1 text-sm text-ui-muted'>The collector status is available, but its run history could not be read. This is not the same as zero runs.</p>
        </DashboardPanel> : null}

        {available && (runs.length > 0 || page > 1) ? <RunActivityPanel summary={summary} sources={sources} page={page} total={total} /> : (
            <EmptyRunHistory unavailable={!available} sourceCount={sources.length} />
        )}
        <RunAttentionPanel summary={summary} runs={runs} sources={sources} />
    </DashboardPage>
}

function EmptyRunHistory({ unavailable, sourceCount }: { unavailable: boolean, sourceCount: number }) {
    const title = unavailable ? 'Run history is unavailable' : 'No collection history yet'
    const description = unavailable
        ? 'Retry when the collection service is available.'
        : sourceCount
            ? 'The collector is configured, but no completed or active run has been recorded for the global source fleet yet.'
            : 'Add an executable source first. Collection history starts after the first source run.'
    return <DashboardPanel className='border-ui-border bg-ui-panel p-6'>
        <div className='mx-auto max-w-xl text-center'>
            <div className='mx-auto grid h-12 w-12 place-items-center rounded-full bg-ui-primary/10 text-ui-primary'><PlayCircle className='h-6 w-6' /></div>
            <h2 className='mt-4 text-lg font-semibold text-ui-text'>{title}</h2>
            <p className='mt-2 text-sm leading-6 text-ui-muted'>{description}</p>
            <div className='mt-4 flex justify-center gap-2'>
                <Link href='/ti/sources' className='inline-flex h-9 items-center gap-2 rounded-md bg-ui-primary px-3 text-sm font-semibold text-ui-on-primary'>Open source inventory <ArrowRight className='h-4 w-4' /></Link>
            </div>
        </div>
    </DashboardPanel>
}
