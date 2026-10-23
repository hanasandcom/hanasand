import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { buildRouteMetadata } from '../seo'
import { queryParamValue } from '@/utils/pagination'
import { identityAuthUrl, isStagingLocalAuthUiEnabled } from '@/utils/auth/identityRedirect'
import LoginPage from './pageClient'

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
    if (isStagingLocalAuthUiEnabled()) {
        return (
            <LoginPage
                path={queryParamValue(params.path) ?? null}
                serverInternal={params.internal === '1'}
                serverExpired={params.expired === 'true'}
                serverError={queryParamValue(params.error) || undefined}
                initialUsername={queryParamValue(params.username) || undefined}
                stageLocalAuth
            />
        )
    }

    const destination = params.mode === 'signup' ? 'signup' : 'login'
    redirect(identityAuthUrl(destination, queryParamValue(params.path)))
}
