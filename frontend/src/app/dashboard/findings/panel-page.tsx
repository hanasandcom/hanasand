import type { ReactNode } from 'react'

export function DwmPanelPage({ title, meta, children }: { title: string, meta?: ReactNode, children: ReactNode }) {
    return (
        <div className='grid gap-4'>
            <section className='overflow-hidden rounded-lg border border-ui-border bg-ui-panel'>
                <div className='flex flex-col gap-1 border-b border-ui-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between'>
                    <div>
                        <p className='text-[10px] font-semibold uppercase text-ui-primary'>Dark web monitoring</p>
                        <h1 className='mt-1 text-lg font-semibold text-ui-text'>{title}</h1>
                    </div>
                    {meta && <div className='min-w-0 text-xs font-medium text-ui-muted'>{meta}</div>}
                </div>
                <div className='p-3'>
                    {children}
                </div>
            </section>
        </div>
    )
}
