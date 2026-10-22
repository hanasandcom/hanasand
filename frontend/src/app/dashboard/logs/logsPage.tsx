import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { DashboardPage } from 'hanasand/dashboard'
import config from '@/config'
import { backendTargetBase } from '@/utils/proxy/backendTarget'
import LogsPageClient from './pageClient'
import type { Metrics } from './throughputMetrics'

export type LogsPageProps = {
    searchParams?: Promise<Record<string, string | string[] | undefined>>
}
type LogsPageRenderProps = LogsPageProps & { loadThroughputMetrics?: boolean, fillViewport?: boolean }

export default async function LogsPage({ searchParams, loadThroughputMetrics = false, fillViewport = false }: LogsPageRenderProps) {
    const Cookies = await cookies()
    const params = await searchParams
    const serviceParam = Array.isArray(params?.service) ? params?.service[0] : params?.service
    const token = Cookies.get('access_token')?.value
    const id = Cookies.get('id')?.value
    if (!token || !id) {
        return redirect('/logout?path=/login%3Fpath%3D/logs%26expired=true')
    }
    let initialMetrics: Metrics | null = null
    if (loadThroughputMetrics) {
        try {
            const target = backendTargetBase(['logs', 'metrics', 'public'], config.url.api, config.url.ai, process.env.FRONTEND_LOGS_API_URL).url
            const response = await fetch(`${target.replace(/\/+$/, '')}/logs/metrics/public`, { next: { revalidate: 5 }, signal: AbortSignal.timeout(1500) })
            if (response.ok) initialMetrics = await response.json() as Metrics
        } catch {
            // The dashboard can render while the shared metrics snapshot is being recovered.
        }
    }

    return (
        <DashboardPage className={`gap-4 px-2 py-4 ${fillViewport ? 'h-full min-h-0 grid-rows-[minmax(0,1fr)]' : ''}`}>
            <main className={`grid gap-5 ${fillViewport ? 'h-full min-h-0 grid-rows-[minmax(0,1fr)]' : ''}`} data-logs-dashboard>
                <LogsPageClient
                    initialServiceFilter={serviceParam || 'all'}
                    initialMetrics={initialMetrics}
                />
            </main>
        </DashboardPage>
    )
}
