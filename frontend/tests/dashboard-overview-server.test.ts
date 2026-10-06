// @ts-expect-error Bun provides this module when running tests.
import { beforeEach, expect, mock, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { NextRequest } from 'next/server'

let product: (request: NextRequest) => Promise<Response>
let cases: (request: NextRequest) => Promise<Response>
mock.module('../src/app/api/findings/product/route', () => ({ GET: (request: NextRequest) => product(request) }))
mock.module('../src/app/api/cases/route', () => ({ GET: (request: NextRequest) => cases(request) }))
const { loadOpenCases, loadOverview } = await import('../src/app/dashboard/overview/loadOverview')
const { default: Panel, OpenCasesMetric } = await import('../src/app/dashboard/overview/overviewPanel')
const snapshot = { schemaVersion: 'test', tenantId: 'org-a', watchlist: [], sourceCoverage: [] }
beforeEach(() => {
    product = async () => Response.json(snapshot)
    cases = async () => Response.json({ items: [{ status: 'open' }, { status: 'resolved' }] })
})
test('monitoring overview is server-loaded without waiting for the cases collection', async () => {
    let releaseCases!: () => void
    const casesGate = new Promise<void>(resolve => { releaseCases = resolve })
    let casesRequested = false
    let caseCalls = 0
    product = async request => {
        expect(request.cookies.get('access_token')?.value).toBe('session-a')
        expect(request.nextUrl.searchParams.get('organizationId')).toBe('org-a')
        return Response.json(snapshot)
    }
    cases = async request => {
        caseCalls++
        expect(request.cookies.get('id')?.value).toBe('user-a')
        expect(request.nextUrl.searchParams.get('organizationId')).toBe('org-a')
        casesRequested = true
        await casesGate
        return Response.json({ items: [{ status: 'open' }, { status: 'closed' }] })
    }
    const overviewStartedAt = performance.now()
    const state = await loadOverview('id=user-a; access_token=session-a', 'org-a')
    expect(performance.now() - overviewStartedAt).toBeLessThan(20)
    expect(state).toMatchObject({ status: 'ready', snapshot })
    expect(casesRequested).toBe(false)
    const openCases = loadOpenCases('id=user-a; access_token=session-a', 'org-a')
    expect(casesRequested).toBe(true)
    releaseCases()
    expect(await openCases).toBe(1)
    const cacheStartedAt = performance.now()
    expect(await loadOpenCases('id=user-a; access_token=session-a', 'org-a')).toBe(1)
    expect(performance.now() - cacheStartedAt).toBeLessThan(20)
    expect(caseCalls).toBe(1)
    const html = renderToStaticMarkup(createElement(Panel, { organizationId: 'org-a', state, openCases: createElement(OpenCasesMetric, { count: 1 }) }))
    expect(html).toContain('Welcome to Hanasand')
    expect(html).not.toContain('Loading')
})
test('case loading reports unknown on failure and product loading returns fresh data', async () => {
    cases = async () => { throw Error('offline') }
    expect(await loadOpenCases('id=user-a')).toBeNull()
    product = async () => Response.json({ error: { message: 'Session expired.' } }, { status: 401 })
    const state = await loadOverview('id=user-b')
    expect(state).toEqual({ status: 'error', message: 'Session expired.' })
    expect(renderToStaticMarkup(createElement(Panel, { state, openCases: createElement(OpenCasesMetric, { count: null }) }))).toContain('Session expired.')
})
test('rejects data for a different organization', async () => {
    expect(await loadOverview('id=user-a', 'org-b')).toEqual({ status: 'error', message: 'Organization monitoring returned an unexpected tenant scope.' })
})

const { default: Loading } = await import('../src/app/loading')
test('app loading fallback renders synchronously for every route', () => {
    const fallback = Loading()
    expect(fallback).not.toBeInstanceOf(Promise)
    expect(renderToStaticMarkup(createElement(() => fallback))).toContain('Loading')
})
