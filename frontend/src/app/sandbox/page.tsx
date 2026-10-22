import type { Metadata } from 'next'
import BrowserPageClient from './_browser/browser/pageClient'
import type { BrowserInitialData } from './_browser/browser/types'
import { buildRouteMetadata } from './_browser/browser/seo'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Sandbox',
    description: 'Investigate domains quickly. Onion addresses are also supported.',
    path: '/sandbox',
    keywords: ['sandbox', 'domain investigation', 'url analysis', 'onion browser'],
})

export const dynamic = 'force-dynamic'

export default function SandboxPage() {
    const initialData: BrowserInitialData = { history: [], quota: null, stats: null }
    return <BrowserPageClient initialData={initialData} />
}
