'use client'

import { RefreshCcw } from 'lucide-react'
import { DashboardPage } from 'hanasand/dashboard'

export default function DashboardDwmError({ reset }: { error: Error & { digest?: string }, reset: () => void }) {
    return (
        <DashboardPage>
            <section className='rounded-lg border border-ui-border bg-ui-panel p-5'>
                <div className='flex flex-col gap-4 md:flex-row md:items-start md:justify-between'>
                    <div>
                        <h2 className='text-base font-semibold text-ui-text'>Case view could not be loaded.</h2>
                        <p className='mt-2 max-w-2xl text-sm leading-6 text-ui-muted'>Try again in a moment.</p>
                    </div>
                    <button
                        type='button'
                        onClick={reset}
                        className='inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-ui-primary px-4 text-sm font-semibold text-ui-on-primary transition hover:opacity-90'
                    >
                        <RefreshCcw className='h-4 w-4' />
                        Retry
                    </button>
                </div>
            </section>
        </DashboardPage>
    )
}
