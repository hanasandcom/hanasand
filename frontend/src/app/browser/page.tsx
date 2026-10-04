import type { Metadata } from 'next'
import config from '@/config'
import { buildRouteMetadata } from '../seo'
import BrowserPageClient, { type BrowserInitialData } from './pageClient'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Browser',
    description: 'Unified regular-web and Tor browser workspace with saved investigation profiles, screenshot timeline capture, and SOC analyst summary output.',
    path: '/browser',
    keywords: ['browser investigation', 'malware url analysis', 'soc url analysis', 'tor browser workspace', 'browser screenshot timeline'],
})

export const dynamic = 'force-dynamic'

async function loadStats(): Promise<BrowserInitialData['stats']> {
    try {
        const response = await fetch(`${config.url.api.replace(/\/$/, '')}/browser/stats`, {
            next: { revalidate: 30 },
            signal: AbortSignal.timeout(1500),
        })
        if (!response.ok) return null

        const stats = await response.json() as { runs24h?: unknown; darkwebRuns24h?: unknown }
        if (!Number.isFinite(stats.runs24h) || !Number.isFinite(stats.darkwebRuns24h)) return null

        return { runs24h: Number(stats.runs24h), darkwebRuns24h: Number(stats.darkwebRuns24h) }
    } catch {
        return null
    }
}

export default async function BrowserPage() {
    const initialData: BrowserInitialData = { history: [], quota: null, stats: await loadStats() }
    return <BrowserPageClient initialData={initialData} />
}
