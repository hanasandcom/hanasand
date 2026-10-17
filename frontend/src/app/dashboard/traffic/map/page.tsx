import DomainSelector from '@/components/monitoring/traffic/domainSelector'
import TrafficMap from '@/components/monitoring/traffic/trafficMap'
import { Suspense } from 'react'
import { getTrafficDashboardData } from '@/utils/monitoring/data'
import { DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import { TrafficPageState } from '../TrafficPageState'

export const dynamic = 'force-dynamic'

export default async function Page({ searchParams }: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const params = await searchParams
    const selectedDomain = typeof params.domain === 'string' ? params.domain : undefined

    return (
        <DashboardPage>
            <Suspense key={selectedDomain || 'all'} fallback={<TrafficPageState kind='loading' message='Loading live traffic map…' />}>
                <LiveTrafficMap selectedDomain={selectedDomain} />
            </Suspense>
        </DashboardPage>
    )
}

async function LiveTrafficMap({ selectedDomain }: { selectedDomain?: string }) {
    const data = await getTrafficDashboardData(selectedDomain)
    if (!data) {
        return <TrafficPageState kind='unavailable' message='Traffic statistics are temporarily unavailable. Refresh to try again.' />
    }

    return (
        <div className='grid min-w-0 gap-4'>
            <DashboardPanel className='p-3'>
                <DomainSelector domains={data.domains.domains} selectedDomain={selectedDomain} />
            </DashboardPanel>
            <TrafficMap initialMetrics={data.metrics} initialRecords={data.records.result} selectedDomain={selectedDomain} />
        </div>
    )
}
