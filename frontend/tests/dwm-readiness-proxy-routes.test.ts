// @ts-expect-error Bun provides this module when running focused tests.
import { expect, mock, test } from 'bun:test'
import { NextRequest, NextResponse } from 'next/server'

const tiCalls: Array<{ request: NextRequest, path: string, options: unknown }> = []
const readiness = {
    schemaVersion: 'dwm.alert_generation_readiness.v1',
    readyForCustomerDelivery: true,
    counts: { candidateCount: 2 },
    generationEvidenceWindow: { captureIds: ['capture-1'], sourceFamilies: ['telegram'], lastObservedAt: '2026-10-16T10:00:00.000Z' },
}
const exposure = {
    generatedAt: '2026-10-16T10:00:00.000Z',
    status: 'stale',
    counts: { total: 4, visible: 1 },
    page: { limit: 1, offset: 2, nextOffset: null },
    items: [{ id: 'capture-1', actor: 'Actor', company: 'Company', status: 'unverified' }],
}

mock.module('../src/app/api/findings/_tiProxy', () => ({
    proxyTiRequest: (request: NextRequest, path: string, options: unknown) => {
        tiCalls.push({ request, path, options })
        return path.endsWith('/exposure-queue')
            ? NextResponse.json(exposure, { status: 207 })
            : NextResponse.json(readiness, { status: 206 })
    },
}))

const { GET: getReadiness } = await import('../src/app/api/findings/alerts/generation-readiness/route')
const { GET: getExposureQueue } = await import('../src/app/api/findings/exposure-queue/route')

test('generation readiness returns the authoritative proxy result', async () => {
    tiCalls.length = 0
    const request = new NextRequest('https://app.example/api/findings/alerts/generation-readiness?organizationId=org-1')
    const response = await getReadiness(request)

    expect(response.status).toBe(206)
    expect(await response.json()).toEqual(readiness)
    expect(tiCalls).toHaveLength(1)
    expect(tiCalls[0]?.request).toBe(request)
    expect(tiCalls[0]?.path).toBe('/v1/dwm/alerts/generation-readiness')
    expect(tiCalls[0]?.options).toEqual({ method: 'GET' })
})

test('exposure queue preserves authoritative snapshot fields and request scope', async () => {
    tiCalls.length = 0
    const request = new NextRequest('https://app.example/api/findings/exposure-queue?tenantId=default&limit=1&offset=2')
    const response = await getExposureQueue(request)

    expect(response.status).toBe(207)
    expect(await response.json()).toEqual(exposure)
    expect(tiCalls).toHaveLength(1)
    expect(tiCalls[0]?.request).toBe(request)
    expect(tiCalls[0]?.path).toBe('/v1/dwm/exposure-queue')
    expect(tiCalls[0]?.options).toEqual({ method: 'GET' })
    expect(tiCalls[0]?.request.nextUrl.searchParams.toString()).toBe('tenantId=default&limit=1&offset=2')
})
