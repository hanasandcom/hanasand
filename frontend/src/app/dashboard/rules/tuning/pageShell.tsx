'use client'

import { useEffect, useState, type ComponentType } from 'react'

type TuningPage = ComponentType

export default function TuningPageShell() {
    const [Page, setPage] = useState<TuningPage | null>(null)

    useEffect(() => {
        let active = true
        void import('./pageClient').then(module => {
            if (active) setPage(() => module.default)
        })
        return () => { active = false }
    }, [])

    if (Page) return <Page />
    return <main className='grid min-h-full w-full content-start gap-3 px-2 py-4 text-ui-text sm:gap-4' aria-busy='true'>
        <header>
            <h1 className='text-2xl font-semibold'>Log tuning</h1>
            <p className='mt-1 text-sm text-ui-muted'>The 100 largest stored log patterns, grouped by message, IP, and user agent.</p>
        </header>
        <section role='status' aria-label='Loading log patterns' className='min-h-48 rounded-xl border border-ui-border bg-ui-panel p-4'>Loading patterns…</section>
    </main>
}
