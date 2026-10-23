import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { buildRouteMetadata } from '../seo'
import { queryParamValue } from '@/utils/pagination'
import { identityAuthUrl } from '@/utils/auth/identityRedirect'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Sign up',
    description: 'Create your Hanasand account.',
    path: '/signup',
})

export default async function Page({ searchParams }: {
    searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
    const params = await searchParams
    redirect(identityAuthUrl('signup', queryParamValue(params.path)))
}
