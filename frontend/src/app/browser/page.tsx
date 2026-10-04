import type { Metadata } from 'next'
import { buildRouteMetadata } from '../seo'
import BrowserPageClient, { type BrowserInitialData } from './pageClient'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Browser',
    description: 'Unified regular-web and Tor browser workspace with saved investigation profiles, screenshot timeline capture, and SOC analyst summary output.',
    path: '/browser',
    keywords: ['browser investigation', 'malware url analysis', 'soc url analysis', 'tor browser workspace', 'browser screenshot timeline'],
})

export const dynamic = 'force-dynamic'

export default function BrowserPage() {
    const initialData: BrowserInitialData = { history: [], quota: null, stats: null }
    return <BrowserPageClient initialData={initialData} />
}
