import type { ReactNode } from 'react'

type AuthActionLayoutProps = {
    tagline: string
    children: ReactNode
    cardGap?: 'gap-3' | 'gap-4'
}

export default function AuthActionLayout({ tagline, children, cardGap = 'gap-4' }: AuthActionLayoutProps) {
    return (
        <section className='grid min-h-app-viewport w-full place-items-center bg-ui-canvas px-4 py-10 text-ui-text md:px-10'>
            <div className='grid w-full max-w-98 gap-4'>
                <div className='grid justify-items-center gap-2 pb-2 text-center'>
                    <h1 className='text-[40px] font-semibold leading-none tracking-normal text-ui-text'>Hanasand</h1>
                    <p className='text-sm font-medium text-ui-muted'>{tagline}</p>
                </div>
                <div className={`grid w-full ${cardGap} rounded-lg border border-ui-border bg-ui-panel p-4 shadow-md md:p-5`}>
                    {children}
                </div>
            </div>
        </section>
    )
}
