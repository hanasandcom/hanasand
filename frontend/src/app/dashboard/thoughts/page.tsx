import DashboardThought from '@/components/thoughts/dashboardThought'
import DashboardMetricCard from '@/components/dashboard/dashboardMetricCard'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import fetchWorkspaceContent from '@/utils/organizations/fetchWorkspaceContent'
import { BrainCircuit, Clock3, Plus, Radio, UserRound } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function Page() {
    const thoughts = await fetchWorkspaceContent<Thought>('thoughts')
    const latest = [...thoughts].sort((a, b) => dateMs(b.updated_at || b.created_at) - dateMs(a.updated_at || a.created_at))[0]
    const authors = new Set(thoughts.map((thought) => thought.created_by).filter(Boolean))

    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Publishing'
                title='Thoughts'
                description='Short philosophical questions for the public site.'
                actions={
                    <Link href='/content/thoughts/create' className='flex h-9 items-center gap-2 rounded-lg bg-ui-primary px-3.5 text-sm font-medium text-ui-on-primary transition hover:opacity-90'>
                        <Plus className='h-4 w-4' />
                        <span>Create</span>
                    </Link>
                }
            />

            {!thoughts.length ? <DashboardPanel className='grid min-h-80 place-items-center border-ui-border bg-ui-panel p-8 text-center'>
                <div className='max-w-md'>
                    <div className='mx-auto grid h-12 w-12 place-items-center rounded-full bg-ui-primary/10 text-ui-primary'>
                        <BrainCircuit className='h-6 w-6' />
                    </div>
                    <h2 className='mt-4 text-xl font-semibold text-ui-text'>Create your first thought</h2>
                    <div className='mt-5 flex justify-center gap-2'>
                        <Link href='/content/thoughts/create' className='inline-flex h-9 items-center gap-2 rounded-md bg-ui-primary px-3 text-sm font-semibold text-ui-on-primary'>
                            <Plus className='h-4 w-4' />
                            Create
                        </Link>
                    </div>
                </div>
            </DashboardPanel> : null}

            {thoughts.length ? <section className='grid gap-3 md:grid-cols-2 xl:grid-cols-4'>
                <DashboardMetricCard icon={<BrainCircuit className='h-4 w-4' />} label='Thoughts' value={String(thoughts.length)} detail='philosophical questions' tone={thoughts.length ? 'ok' : 'watch'} />
                <DashboardMetricCard icon={<Clock3 className='h-4 w-4' />} label='Latest movement' value={latest ? shortDate(latest.updated_at || latest.created_at) : 'Open'} detail={latest?.title || 'Create the first thought'} tone={latest ? 'ok' : 'neutral'} />
                <DashboardMetricCard icon={<UserRound className='h-4 w-4' />} label='Authors' value={String(authors.size)} detail='thought contributors' tone={authors.size ? 'ok' : 'neutral'} />
                <DashboardMetricCard icon={<Radio className='h-4 w-4' />} label='Publishing' value={thoughts.length ? 'Live' : 'Ready'} detail='thoughts for the public site' tone={thoughts.length ? 'ok' : 'watch'} />
            </section> : null}

            {thoughts.length ? <DashboardPanel className='overflow-hidden border-ui-border bg-ui-panel p-0'>
                <div className='flex flex-wrap items-center justify-between gap-3 border-b border-ui-border bg-ui-panel px-4 py-3'>
                    <div>
                        <h2 className='text-base font-semibold text-ui-text'>Thoughts</h2>
                        <p className='mt-1 text-sm text-ui-muted'>Recent philosophical questions.</p>
                    </div>
                    <span className='rounded-full border border-ui-primary/35 bg-ui-primary/10 px-3 py-1 text-xs font-semibold text-ui-on-primary'>
                        {thoughts.length} rows
                    </span>
                </div>
                <div className='grid gap-1 p-3'>
                    {thoughts.length ? thoughts.map((thought) => <DashboardThought key={thought.id} thought={thought} />) : (
                        <div className='rounded-lg border border-dashed border-ui-border bg-ui-canvas p-4 text-sm text-ui-muted'>
                            Create a thought to share a philosophical question.
                        </div>
                    )}
                </div>
            </DashboardPanel> : null}
        </DashboardPage>
    )
}

function dateMs(value: string) {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}

function shortDate(value: string) {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return 'Synced'
    return date.toLocaleString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
