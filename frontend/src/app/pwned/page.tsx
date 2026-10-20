import PwnedPageClient from './pageClient'
import type { Metadata } from 'next'
import { buildRouteMetadata } from '../seo'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Check Password',
    description: 'Check a password hash against leaked-password records. Only a short hash prefix is sent.',
    path: '/pwned',
    keywords: ['password check', 'SHA-1 hash', 'leaked password check'],
})

export default async function Page() {
    return (
        <main className='grid min-h-app-viewport w-full place-items-center bg-ui-canvas px-4 py-10 text-ui-text md:px-10'>
            <div className='grid w-full max-w-5xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center'>
                <div className='grid gap-4'>
                    <h1 className='text-4xl font-semibold tracking-normal md:text-5xl'>Has your password been leaked?</h1>
                    <p className='max-w-xl text-base leading-7 text-ui-muted'>
                        Hash your password and check it.
                    </p>
                </div>
                <PwnedPageClient />
            </div>
        </main>
    )
}
