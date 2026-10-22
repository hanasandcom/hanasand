import { notFound } from 'next/navigation'
import BrowserPageClient from '../_browser/browser/pageClient'

export const dynamic = 'force-dynamic'

export default async function SandboxResultPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ run?: string }> }) {
    const [{ id }, query] = await Promise.all([params, searchParams])
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) notFound()
    return <BrowserPageClient resultId={id} resultRunId={typeof query.run === 'string' ? query.run : undefined} initialData={{ history: [], quota: null, stats: null }} />
}
