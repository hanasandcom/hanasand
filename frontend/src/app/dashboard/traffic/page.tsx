import TrafficOverviewClient from '@/components/monitoring/traffic/trafficOverview'
import { Suspense } from 'react'
import { getTrafficDashboardData } from '@/utils/monitoring/data'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'

export const dynamic = 'force-dynamic'

export default async function Page({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const params = await searchParams
    const selectedDomain = typeof params.domain === 'string' ? params.domain : undefined

    return (
        <DashboardPage>
            <DashboardHeader eyebrow='Operations' title='Traffic overview' description='Request volume, response times, routes, and errors.' />
            <Suspense key={selectedDomain || 'all'} fallback={<DashboardPanel className='p-4'><p role='status'>Loading traffic statistics…</p></DashboardPanel>}>
                <TrafficOverview selectedDomain={selectedDomain} />
            </Suspense>
        </DashboardPage>
    )
}

async function TrafficOverview({ selectedDomain }: { selectedDomain?: string }) {
    const data = await getTrafficDashboardData(selectedDomain)
    if (!data) {
        return <DashboardPanel className='p-4'><p role='alert'>Traffic statistics are temporarily unavailable. Refresh to try again.</p></DashboardPanel>
    }

    return <TrafficOverviewClient domains={data.domains} initialMetrics={data.metrics} initialRecords={data.records} selectedDomain={selectedDomain} />
}
