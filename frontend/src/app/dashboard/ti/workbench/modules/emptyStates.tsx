import Link from 'next/link'
import { Inbox } from 'lucide-react'

export function EmptyWorkspace() {
    return (
        <div className='grid gap-4 p-5'>
            <div className='rounded-lg border border-dashed border-ui-border bg-ui-raised p-5'>
                <h2 className='text-lg font-semibold text-ui-text'>No cases to review</h2>
                <p className='mt-2 text-sm leading-6 text-ui-muted'>Create watched terms, review source coverage, or run collection to produce the first actionable case.</p>
                <div className='mt-4 flex flex-wrap gap-2'>
                    <Link href='/findings' className='inline-flex h-9 items-center rounded-lg bg-ui-primary px-3 text-xs font-semibold text-ui-on-primary transition hover:bg-ui-primary'>Open dark web cases</Link>
                    <Link href='/ti/sources' className='inline-flex h-9 items-center rounded-lg border border-ui-border bg-ui-panel px-3 text-xs font-semibold text-ui-text transition hover:bg-ui-raised'>Review sources</Link>
                    <Link href='/automation?setup=dwm' className='inline-flex h-9 items-center rounded-lg border border-ui-border bg-ui-panel px-3 text-xs font-semibold text-ui-text transition hover:bg-ui-raised'>Configure delivery</Link>
                </div>
            </div>
        </div>
    )
}

export function AttackWelcome() {
    return (
        <section className='grid min-h-[28rem] place-items-center rounded-lg border border-ui-border bg-ui-panel p-6'>
            <div className='max-w-xl text-center'>
                <div className='mx-auto grid h-14 w-14 place-items-center rounded-full bg-ui-primary/10 text-ui-primary'><Inbox className='h-7 w-7' /></div>
                <h2 className='mt-5 text-2xl font-semibold text-ui-text'>Attack monitoring is ready</h2>
                <p className='mt-3 text-sm leading-6 text-ui-muted'>Actionable cases are created when monitored sources produce a relevant exposure. Start with the source inventory or open the dark web case workspace to configure monitoring.</p>
                <div className='mt-5 flex flex-wrap justify-center gap-2'>
                    <Link href='/findings' className='inline-flex h-10 items-center gap-2 rounded-lg bg-ui-primary px-4 text-sm font-semibold text-ui-on-primary'>Open dark web cases</Link>
                    <Link href='/ti/sources' className='inline-flex h-10 items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-4 text-sm font-semibold text-ui-text transition hover:bg-ui-panel'>Browse sources</Link>
                </div>
            </div>
        </section>
    )
}
