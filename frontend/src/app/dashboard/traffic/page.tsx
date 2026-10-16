import TrafficOverviewClient from '@/components/monitoring/traffic/trafficOverview'
import { Suspense } from 'react'
import { getTrafficDashboardData } from '@/utils/monitoring/data'
import { DashboardHeader, DashboardPage } from '@/components/dashboard/ui'
import { TrafficPageState } from './TrafficPageState'

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
            <Suspense key={selectedDomain || 'all'} fallback={<TrafficPageState kind='loading' message='Loading traffic statistics…' />}>
                <TrafficOverview selectedDomain={selectedDomain} />
            </Suspense>
        </DashboardPage>
    )
}

async function TrafficOverview({ selectedDomain }: { selectedDomain?: string }) {
    const data = await getTrafficDashboardData(selectedDomain)
    if (!data) {
        return <TrafficPageState kind='unavailable' message='Traffic statistics are temporarily unavailable. Refresh to try again.' />
    }

    return <TrafficOverviewClient domains={data.domains} initialMetrics={data.metrics} initialRecords={data.records} selectedDomain={selectedDomain} />
}
