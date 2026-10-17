import DashboardThought from '@/components/thoughts/dashboardThought'
import { DashboardContentQueue } from '@/components/dashboard/dashboardContentQueue'
import DashboardMetricCard from '@/components/dashboard/dashboardMetricCard'
import { DashboardPublishingEmptyState } from '@/components/dashboard/dashboardPublishingEmptyState'
import { DashboardPage } from '@/components/dashboard/ui'
import fetchWorkspaceContent from '@/utils/organizations/fetchWorkspaceContent'
import dateSortValue from '@/utils/date/dateSortValue'
import formatCompactDateTime from '@/utils/date/formatCompactDateTime'
import { BrainCircuit, Clock3, Plus, Radio, UserRound } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function Page() {
    const thoughts = await fetchWorkspaceContent<Thought>('thoughts')
    const latest = [...thoughts].sort((a, b) => dateSortValue(b.updated_at || b.created_at) - dateSortValue(a.updated_at || a.created_at))[0]
    const authors = new Set(thoughts.map((thought) => thought.created_by).filter(Boolean))

    return (
        <DashboardPage>
            {!thoughts.length ? <DashboardPublishingEmptyState
                icon={<BrainCircuit className='h-6 w-6' />}
                title='Create your first thought'
                action={<div className='mt-5 flex justify-center gap-2'>
                    <Link href='/content/thoughts/create' className='inline-flex h-9 items-center gap-2 rounded-md bg-ui-primary px-3 text-sm font-semibold text-ui-on-primary'>
                        <Plus className='h-4 w-4' />
                        Create
                    </Link>
                </div>}
            /> : null}

            {thoughts.length ? <section className='grid gap-3 md:grid-cols-2 xl:grid-cols-4'>
                <DashboardMetricCard icon={<BrainCircuit className='h-4 w-4' />} label='Thoughts' value={String(thoughts.length)} detail='philosophical questions' tone={thoughts.length ? 'ok' : 'watch'} />
                <DashboardMetricCard icon={<Clock3 className='h-4 w-4' />} label='Latest movement' value={latest ? formatCompactDateTime(latest.updated_at || latest.created_at) : 'Open'} detail={latest?.title || 'Create the first thought'} tone={latest ? 'ok' : 'neutral'} />
                <DashboardMetricCard icon={<UserRound className='h-4 w-4' />} label='Authors' value={String(authors.size)} detail='thought contributors' tone={authors.size ? 'ok' : 'neutral'} />
                <DashboardMetricCard icon={<Radio className='h-4 w-4' />} label='Publishing' value={thoughts.length ? 'Live' : 'Ready'} detail='thoughts for the public site' tone={thoughts.length ? 'ok' : 'watch'} />
            </section> : null}

            {thoughts.length ? <DashboardContentQueue
                title='Thoughts'
                description='Recent philosophical questions.'
                count={thoughts.length}
            >
                {thoughts.map(thought => <DashboardThought key={thought.id} thought={thought} />)}
            </DashboardContentQueue> : null}
        </DashboardPage>
    )
}
