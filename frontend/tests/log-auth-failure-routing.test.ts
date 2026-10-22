import { expect, test } from 'bun:test'
import { NextRequest } from 'next/server'
import { recordFrontendAuthFailure } from '../src/app/api/auth/login/failureLogging'

test('login failure events are sent to the independent Logs API with a server-side credential', async () => {
    const previousUrl = process.env.LOGS_SERVICE_URL
    const previousToken = process.env.LOGS_SERVICE_INGEST_TOKEN
    const previousFetch = globalThis.fetch
    const previousWarn = console.warn
    let request: { url: string, init?: RequestInit } | undefined
    process.env.LOGS_SERVICE_URL = 'https://logs.hanasand.com/'
    process.env.LOGS_SERVICE_INGEST_TOKEN = 'l'.repeat(48)
    globalThis.fetch = (async (input, init) => {
        request = { url: String(input), init }
        return new Response(null, { status: 201 })
    }) as typeof fetch
    console.warn = () => {}
    try {
        await recordFrontendAuthFailure({
            req: new NextRequest('https://app.hanasand.com/api/auth/login', { headers: { 'x-request-id': 'request-1' } }),
            id: 'user-1', redirectPath: '/dashboard', statusCode: 401, errorCode: 'bad_password', message: 'Login failed.',
        })
        expect(request?.url).toBe('https://logs.hanasand.com/api/ingest')
        expect(new Headers(request?.init?.headers).get('authorization')).toBe(`Bearer ${'l'.repeat(48)}`)
        const event = JSON.parse(String(request?.init?.body))
        expect(event).toMatchObject({
            service: 'hanasand-frontend',
            metadata: { category: 'http_response_error', surface: 'auth', request_id: 'request-1', user_id: 'user-1' },
        })
    } finally {
        if (previousUrl === undefined) delete process.env.LOGS_SERVICE_URL
        else process.env.LOGS_SERVICE_URL = previousUrl
        if (previousToken === undefined) delete process.env.LOGS_SERVICE_INGEST_TOKEN
        else process.env.LOGS_SERVICE_INGEST_TOKEN = previousToken
        globalThis.fetch = previousFetch
        console.warn = previousWarn
    }
})

test('login failure logging does not fall back to the Hanasand API without Logs credentials', async () => {
    const previousUrl = process.env.LOGS_SERVICE_URL
    const previousToken = process.env.LOGS_SERVICE_INGEST_TOKEN
    const previousFetch = globalThis.fetch
    const previousWarn = console.warn
    let called = false
    delete process.env.LOGS_SERVICE_URL
    delete process.env.LOGS_SERVICE_INGEST_TOKEN
    globalThis.fetch = (async () => { called = true; return new Response(null, { status: 201 }) }) as typeof fetch
    console.warn = () => {}
    try {
        await recordFrontendAuthFailure({
            req: new NextRequest('https://app.hanasand.com/api/auth/login'),
            id: 'user-1', redirectPath: '/dashboard', statusCode: 502, errorCode: 'auth_service_unavailable', message: 'Unavailable.',
        })
        expect(called).toBe(false)
    } finally {
        if (previousUrl === undefined) delete process.env.LOGS_SERVICE_URL
        else process.env.LOGS_SERVICE_URL = previousUrl
        if (previousToken === undefined) delete process.env.LOGS_SERVICE_INGEST_TOKEN
        else process.env.LOGS_SERVICE_INGEST_TOKEN = previousToken
        globalThis.fetch = previousFetch
        console.warn = previousWarn
    }
})
