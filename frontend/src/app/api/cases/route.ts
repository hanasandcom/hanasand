import { NextRequest, NextResponse } from 'next/server'
import { proxyTiRequest } from '../findings/_tiProxy'

import { GET as monitoringCases } from './monitoring/route'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    const collection = request.nextUrl.searchParams.get('collection')
    const summaryOnly = request.nextUrl.searchParams.get('summary') === 'true'
    if (collection === 'intelligence') return proxyTiRequest(request, '/v1/cases', { method: 'GET', ...(summaryOnly ? { timeoutMs: 5_000 } : {}) })
    if (collection === 'monitoring') return monitoringCases(summaryOnly ? withQuery(request, { view: 'count' }) : request)
    if (collection !== null) return NextResponse.json({ error: 'Unknown case collection.' }, { status: 400 })
    const intelligenceRequest = summaryOnly ? withQuery(request, { summary: 'true' }) : request
    const monitoringRequest = summaryOnly ? withQuery(request, { view: 'count' }) : request
    const responses = await Promise.allSettled([
        proxyTiRequest(intelligenceRequest, '/v1/cases', { method: 'GET', ...(summaryOnly ? { timeoutMs: 5_000 } : {}) }), monitoringCases(monitoringRequest),
    ])
    const items: Record<string, unknown>[] = []
    const warnings: string[] = []
    let available = 0
    let metadata: Record<string, unknown> = {}
    let monitoringTotal = 0
    for (const [index, result] of responses.entries()) {
        if (result.status === 'fulfilled' && [401, 403].includes(result.value.status)) return result.value
        if (result.status === 'fulfilled' && result.value.ok) {
            const payload = await result.value.json()
            if (index === 0) metadata = payload
            else monitoringTotal = Number.isFinite(Number(payload.total)) ? Number(payload.total) : (payload.items || []).length
            if (index === 0 || !request.nextUrl.searchParams.has('cursor') && Number(request.nextUrl.searchParams.get('page') || 1) === 1) items.push(...(payload.items || payload.cases || []))
            available++
        } else warnings.push(`${index === 0 ? 'Intelligence' : 'Monitoring'} cases are unavailable. Retry to load them.`)
    }
    if (summaryOnly) return NextResponse.json({ total: Number(metadata.total || 0) + monitoringTotal, warnings }, { status: available ? 200 : 503, headers: { 'cache-control': 'no-store' } })
    items.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
    return NextResponse.json({ ...metadata, items, cases: items, total: Number(metadata.total || 0) + monitoringTotal, warnings }, { status: available ? 200 : 503, headers: { 'cache-control': 'no-store' } })
}

function withQuery(request: NextRequest, values: Record<string, string>) {
    const url = new URL(request.url)
    for (const [key, value] of Object.entries(values)) url.searchParams.set(key, value)
    return new NextRequest(url, { method: request.method, headers: request.headers })
}

export async function POST(request: NextRequest) {
    return proxyTiRequest(request, '/v1/cases', { method: 'POST' })
}
