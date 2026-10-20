import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { buildRouteMetadata } from '../seo'
import GalleryPageClient from './pageClient'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Gallery',
    description: 'Browse your uploaded files and copy shareable links.',
    path: '/gallery',
    keywords: ['hanasand gallery', 'media uploads'],
})

export const dynamic = 'force-dynamic'

export default async function Page() {
    const cookieStore = await cookies()
    if (!cookieStore.get('id')?.value || !cookieStore.get('access_token')?.value) {
        redirect('/login?path=%2Fgallery')
    }
    return <GalleryPageClient />
}
