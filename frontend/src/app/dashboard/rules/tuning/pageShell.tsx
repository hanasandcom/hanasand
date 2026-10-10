'use client'

import dynamic from 'next/dynamic'

const TuningPage = dynamic(() => import('./pageClient'), {
    ssr: false,
    loading: () => <main className='grid min-h-full w-full content-start gap-3 px-2 py-4 text-ui-text sm:gap-4'>
        <header>
            <h1 className='text-2xl font-semibold'>Log tuning</h1>
            <p className='mt-1 text-sm text-ui-muted'>The 100 largest stored log patterns, grouped by message, IP, and user agent.</p>
        </header>
        <section role='status' aria-busy='true' className='min-h-48 rounded-xl border border-ui-border bg-ui-panel p-4'>Loading patterns…</section>
    </main>,
})

export default function TuningPageShell() {
    return <TuningPage />
}
