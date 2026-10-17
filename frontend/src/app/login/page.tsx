import LoginPage from './pageClient'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { buildRouteMetadata } from '../seo'
import { queryParamValue } from '@/utils/pagination'

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
    if (params.mode === 'signup') {
        const query = new URLSearchParams()
        for (const key of ['path', 'error']) {
            const value = queryParamValue(params[key])
            if (value) query.set(key, value)
        }
        redirect(`/signup${query.size ? `?${query}` : ''}`)
    }
    const internal = readBooleanParam(params.internal)
    const expired = readBooleanParam(params.expired)
    const path = queryParamValue(params.path) || null

    const socialError = typeof params.socialError === 'string' ? params.socialError.slice(0, 400) : undefined
    const initialUsername = typeof params.username === 'string' ? params.username.slice(0, 254) : undefined
    return <LoginPage serverInternal={internal} path={path} serverExpired={expired} socialError={socialError} initialMode='login' initialUsername={initialUsername} serverError={typeof params.error === 'string' ? params.error.slice(0, 500) : undefined} />
}

function readBooleanParam(value: string | string[] | undefined) {
    const next = queryParamValue(value)
    return next === 'true' || next === '1'
}
