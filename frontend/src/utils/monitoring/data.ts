'use server'

import type { TrafficDomains, TrafficMetrics, TrafficRecords } from './types'
import { isTrafficDomains, isTrafficMetrics, isTrafficRecords } from './trafficValidation'
import { requestService } from './serviceApi'

export async function getTrafficDomains() {
    return await requestService<TrafficDomains>('cdn', 'traffic/domains')
}

export async function getTrafficMetrics(domain?: string) {
    const params = new URLSearchParams()
    if (domain) {
        params.set('domain', domain)
    }

    // A cold domain snapshot can take longer than a normal cached request.
    // Its Suspense boundary keeps the page usable while that calculation finishes.
    return await requestService<TrafficMetrics>('cdn', `traffic/metrics?${params.toString()}`, {
        signal: AbortSignal.timeout(60000),
    })
}

export async function getTrafficRecords(domain?: string, limit = 12, page = 1) {
    const params = new URLSearchParams({
        limit: String(limit),
        page: String(page),
    })
    if (domain) {
        params.set('domain', domain)
    }

    return await requestService<TrafficRecords>('cdn', `traffic/records?${params.toString()}`, {
        signal: AbortSignal.timeout(60000),
    })
}

export async function getTrafficDashboardData(domain?: string) {
    const [domains, metrics, records] = await Promise.all([
        getTrafficDomains(),
        getTrafficMetrics(domain),
        getTrafficRecords(domain, 200, 1),
    ])

    if (!isTrafficDomains(domains) || !isTrafficMetrics(metrics) || !isTrafficRecords(records)) return null
    return { domains, metrics, records }
}
