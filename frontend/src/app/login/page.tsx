import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { buildRouteMetadata } from '../seo'
import { queryParamValue } from '@/utils/pagination'
import { identityAuthUrl } from '@/utils/auth/identityRedirect'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Login',
    description: 'Sign in to Hanasand monitoring, webhooks, alerts, and API access.',
    path: '/login',
    keywords: ['hanasand login', 'monitoring console'],
})

export default async function Page({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const params = await searchParams
    const destination = params.mode === 'signup' ? 'signup' : 'login'
    redirect(identityAuthUrl(destination, queryParamValue(params.path)))
}
