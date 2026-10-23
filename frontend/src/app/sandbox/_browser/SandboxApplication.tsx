import BrowserPageClient from './browser/pageClient'
import type { BrowserInitialData } from './browser/types'

export default function SandboxApplication() {
    const initialData: BrowserInitialData = { history: [], quota: null, stats: null }
    return <BrowserPageClient initialData={initialData} />
}
