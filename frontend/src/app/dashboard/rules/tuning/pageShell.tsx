'use client'

import dynamic from 'next/dynamic'
import { DashboardDataFallback, DashboardPage } from '@/components/dashboard/ui'

const TuningPageClient = dynamic(() => import('./pageClient'), {
    ssr: false,
    loading: () => <DashboardPage className='!gap-5 !px-2 !py-4'>
        <header>
            <h1 className='text-2xl font-semibold'>Log tuning</h1>
            <p className='mt-1 text-sm text-ui-muted'>The 100 largest stored log patterns, grouped by message, IP, and user agent.</p>
        </header>
        <DashboardDataFallback label='log patterns' />
    </DashboardPage>,
})

export default function TuningPageShell() {
    return <TuningPageClient />
}
