import { Suspense } from 'react'
import { NextRequest } from 'next/server'
import { GET as getBackend } from '@/app/api/backend/[...path]/route'
import TuningPage, { type TuningData } from './pageClient'

export const dynamic = 'force-dynamic'

export default function TuningPageServer() {
    return <Suspense fallback={<TuningLoadingShell />}><TuningPageData /></Suspense>
}

async function TuningPageData() {
    const request = new NextRequest('http://localhost/api/backend/logs/tuning')
    const response = await getBackend(request, { params: Promise.resolve({ path: ['logs', 'tuning'] }) })
    if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: unknown } | null
        const message = typeof payload?.error === 'string'
            ? payload.error
            : payload?.error && typeof payload.error === 'object' && 'message' in payload.error && typeof payload.error.message === 'string'
                ? payload.error.message
                : 'Log patterns could not be loaded.'
        return <TuningPage initialError={message} />
    }

    const initialData = await response.json() as TuningData
    return <TuningPage initialData={initialData} />
}

function TuningLoadingShell() {
    return <main className='grid min-h-full w-full content-start gap-3 px-2 py-4 text-ui-text sm:gap-4'>
        <header>
            <h1 className='text-2xl font-semibold'>Log tuning</h1>
            <p className='mt-1 text-sm text-ui-muted'>The 100 largest stored log patterns, grouped by message, IP, and user agent.</p>
        </header>
        <section role='status' aria-busy='true' className='min-h-48 rounded-xl border border-ui-border bg-ui-panel p-4'>Loading patterns…</section>
    </main>
}
