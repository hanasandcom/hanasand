import Link from 'next/link'
import { Clock3, FileCode2, LockKeyhole, Plus, Radio, Share2, Text } from 'lucide-react'
import DashboardShare from './dashboardShare'
import { ShareAnalyticsPanel, ShareAnalyticsProvider, ShareAnalyticsToggle } from './shareAnalytics'
import { getUserShares } from '@/utils/share/getUserShares'
import { countLines } from '@/utils/share/countLines'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { DashboardPanel } from 'hanasand/dashboard'
import DashboardMetricCard from '@/components/dashboard/dashboardMetricCard'
import ErrorNotice from '@/components/error/errorNotice'
import { activeOrganizationId } from '@/utils/organizations/serverWorkspace'
import dateSortValue from '@/utils/date/dateSortValue'
import formatCompactDateTime from '@/utils/date/formatCompactDateTime'

export default async function Shares({ title = 'Files', showHeading = true }: { title?: string, showHeading?: boolean } = {}) {
    const Cookies = await cookies()
    const id = Cookies.get('id')?.value
    const token = Cookies.get('access_token')?.value
    if (!id || !token) {
        return redirect('/logout?path=/login%3Fpath%3D/dashboard%26expired=true')
    }

    const shares = await getUserShares({ id, token, organizationId: await activeOrganizationId() })
    const shareRows = typeof shares === 'string' ? [] : shares as Share[]
    const latestShare = [...shareRows].sort((a, b) => dateSortValue(b.timestamp) - dateSortValue(a.timestamp))[0]
    const lockedCount = shareRows.filter(share => share.locked).length
    const totalLines = shareRows.reduce((sum, share) => sum + countLines(share.content), 0)

    return (
        <div className='grid gap-3'>
            <ShareAnalyticsProvider>
                <DashboardPanel className='overflow-hidden border-ui-border bg-ui-panel p-0'>
                    <div className='flex flex-wrap items-start justify-between gap-3 border-b border-ui-border bg-ui-panel px-4 py-3'>
                        <div>
                            <div className='flex items-center gap-2'>
                                <Radio className='h-4 w-4 text-ui-primary' />
                                {showHeading && <h2 className='text-base font-semibold text-ui-text'>{title}</h2>}
                            </div>
                            <p className='mt-1 text-sm text-ui-muted'>
                                {typeof shares === 'string' ? 'Could not load files.' : `${shareRows.length} file${shareRows.length === 1 ? '' : 's'}.`}
                            </p>
                        </div>
                        <div className='flex items-center gap-2'>
                            {shareRows.length > 0 && <ShareAnalyticsToggle />}
                            <Link prefetch={false} href='/s' className='inline-flex h-9 items-center gap-2 rounded-lg border border-ui-primary/35 bg-ui-primary/10 px-3 text-sm font-semibold text-ui-text transition hover:border-ui-primary/35 hover:bg-ui-primary/10'>
                                <Plus className='h-4 w-4' />
                                <span>Create</span>
                            </Link>
                        </div>
                    </div>
                    <div className='grid gap-1 p-3'>
                        {typeof shares === 'string'
                            ? <ErrorNotice compact message={shares} />
                            : shareRows.length
                                ? shareRows.map((share) => <DashboardShare key={share.id} share={share} />)
                                : <div className='grid min-h-64 place-items-center rounded-lg border border-dashed border-ui-border bg-ui-canvas p-8 text-center'>
                                    <div className='max-w-sm'>
                                        <div className='mx-auto grid h-11 w-11 place-items-center rounded-full bg-ui-primary/10 text-ui-primary'>
                                            <Share2 className='h-5 w-5' />
                                        </div>
                                        <h3 className='mt-3 text-lg font-semibold text-ui-text'>No files yet</h3>
                                        <p className='mt-2 text-sm leading-6 text-ui-muted'>Add a file to a repository to make it available to your AI chats.</p>
                                        <Link prefetch={false} href='/s' className='mt-4 inline-flex h-9 items-center gap-2 rounded-md bg-ui-primary px-3 text-sm font-semibold text-ui-on-primary'>
                                            <Plus className='h-4 w-4' />
                                            Create
                                        </Link>
                                    </div>
                                </div>}
                    </div>
                </DashboardPanel>
                {shareRows.length > 0 && <ShareAnalyticsPanel>
                    <DashboardMetricCard icon={<FileCode2 className='h-4 w-4' />} label='Files' value={String(shareRows.length)} detail='total files' tone='ok' />
                    <DashboardMetricCard icon={<LockKeyhole className='h-4 w-4' />} label='Locked' value={String(lockedCount)} detail={`${Math.max(shareRows.length - lockedCount, 0)} unlocked`} tone={lockedCount ? 'watch' : 'ok'} />
                    <DashboardMetricCard icon={<Text className='h-4 w-4' />} label='Lines' value={totalLines.toLocaleString('en-US')} detail='total file lines' tone='neutral' />
                    <DashboardMetricCard icon={<Clock3 className='h-4 w-4' />} label='Latest file' value={latestShare ? formatCompactDateTime(latestShare.timestamp) : 'None'} detail={latestShare?.alias || latestShare?.path || 'No files yet'} tone={latestShare ? 'ok' : 'neutral'} />
                </ShareAnalyticsPanel>}
            </ShareAnalyticsProvider>
        </div>
    )
}
