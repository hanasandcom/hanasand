import type { Metadata } from 'next'
import { getTrafficMetrics } from '@/utils/monitoring/data'
import getMetrics from '@/utils/traffic/getMetrics'
import { getTiAdminOverview } from '@/utils/tiAdmin/ops'
import { buildRouteMetadata } from '../seo'
import MonitorClient from './monitorClient'
import { buildMonitorRows } from './model'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Monitor',
    description: 'Filter monitored customer domains by customer, name, monitoring age, and breach mentions.',
    path: '/monitor',
    keywords: ['hanasand monitor', 'monitored domains', 'customer breach monitoring'],
})

export default async function MonitorPage() {
    const [trafficMetrics, domainTraffic, ti] = await Promise.all([
        getTrafficMetrics(),
        getMetrics('domain'),
        getTiAdminOverview(),
    ])
    const rows = buildMonitorRows({ trafficMetrics, domainTraffic, ti })
    return <MonitorClient initialRows={rows} />
}
