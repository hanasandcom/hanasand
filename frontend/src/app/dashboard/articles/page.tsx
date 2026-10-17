import DashboardArticle from '@/components/articles/dashboardArticle'
import { DashboardContentQueue } from '@/components/dashboard/dashboardContentQueue'
import DashboardMetricCard from '@/components/dashboard/dashboardMetricCard'
import { DashboardPublishingEmptyState } from '@/components/dashboard/dashboardPublishingEmptyState'
import { DashboardHeader, DashboardPage } from '@/components/dashboard/ui'
import fetchWorkspaceContent from '@/utils/organizations/fetchWorkspaceContent'
import dateSortValue from '@/utils/date/dateSortValue'
import { Clock3, FileText, Plus, Radio, Timer } from 'lucide-react'
import Link from 'next/link'

export default async function Page() {
    const articles = await fetchWorkspaceContent<Article>('articles')
    const latest = [...articles].sort((a, b) => dateSortValue(b.modified || b.created) - dateSortValue(a.modified || a.created))[0]
    const totalWords = articles.reduce((sum, article) => sum + (article.metadata?.wordCount || countWords(article.content)), 0)
    const totalMinutes = articles.reduce((sum, article) => sum + (article.metadata?.estimatedMinutes || 0), 0)

    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Publishing'
                title='Articles'
                description='Editorial queue, latest movement, and published research rows.'
                actions={
                    <Link href='/content/articles/create' className='inline-flex h-10 items-center gap-2 rounded-lg bg-ui-primary px-4 text-sm font-semibold text-ui-on-primary transition hover:opacity-90'>
                        <Plus className='h-4 w-4' />
                        Create article
                    </Link>
                }
            />

            {!articles.length ? <DashboardPublishingEmptyState
                icon={<FileText className='h-6 w-6' />}
                title='Publish your first article'
                description='Turn research into a clear public update and start the editorial queue.'
                action={<Link href='/content/articles/create' className='mt-5 inline-flex h-9 items-center gap-2 rounded-md bg-ui-primary px-3 text-sm font-semibold text-ui-on-primary'>
                    <Plus className='h-4 w-4' />
                    Create your first article
                </Link>}
            /> : null}

            {articles.length ? <section className='grid gap-3 md:grid-cols-2 xl:grid-cols-4'>
                <DashboardMetricCard icon={<FileText className='h-4 w-4' />} label='Published' value={String(articles.length)} detail='articles' tone={articles.length ? 'ok' : 'watch'} />
                <DashboardMetricCard icon={<Clock3 className='h-4 w-4' />} label='Latest edit' value={latest ? shortDate(latest.modified || latest.created) : 'Ready'} detail={latest?.title || 'Create the first article'} tone={latest ? 'ok' : 'neutral'} />
                <DashboardMetricCard icon={<Timer className='h-4 w-4' />} label='Reading time' value={totalMinutes ? `${totalMinutes} min` : 'Metering'} detail={`${totalWords.toLocaleString('en-US')} words`} tone='neutral' />
                <DashboardMetricCard icon={<Radio className='h-4 w-4' />} label='Publishing' value={articles.length ? 'Live' : 'Open'} tone={articles.length ? 'ok' : 'watch'} />
            </section> : null}

            {articles.length ? <DashboardContentQueue
                title='Editorial queue'
                description='Newest published and draft rows are streaming here.'
                count={articles.length}
            >
                {articles.map(article => <DashboardArticle key={article.id} article={article} />)}
            </DashboardContentQueue> : null}
        </DashboardPage>
    )
}

function countWords(value: string) {
    return value.trim() ? value.trim().split(/\s+/).length : 0
}

function shortDate(value: string) {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return 'Synced'
    return date.toLocaleString('en', { year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined, month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
