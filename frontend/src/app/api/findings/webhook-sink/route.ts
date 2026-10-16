import { NextRequest, NextResponse } from 'next/server'
import { proxyOrganizationApiRequest } from '@/app/api/organizations/_organizationApiProxy'
import { authApiUrl } from '@/utils/auth/authApiUrl'
import { parseJsonRecord, record, validateDwmWebhookPayload, webhookContext, webhookMatchedTerm } from './webhookPayload'

export const dynamic = 'force-dynamic'
const MAX_WEBHOOK_BYTES = 512 * 1024

export async function POST(request: Request) {
    const receivedAt = new Date().toISOString()
    const text = await request.text()
    const eventId = request.headers.get('x-hanasand-event-id')
        || request.headers.get('x-webhook-id')
        || request.headers.get('x-hanasand-delivery-id')
        || `dwm_sink_${Date.now()}`
    if (new TextEncoder().encode(text).byteLength > MAX_WEBHOOK_BYTES) {
        return NextResponse.json({
            schemaVersion: 'dwm.webhook_sink.acceptance.v1',
            accepted: false,
            eventId,
            receivedAt,
            error: 'DWM webhook payload exceeds the 512 KiB receiver limit.',
        }, {
            status: 413,
            headers: { 'cache-control': 'no-store' },
        })
    }
    const payload = parseJsonRecord(text)
    const context = webhookContext(payload)
    const error = validateDwmWebhookPayload(context)

    if (error) {
        return NextResponse.json({
            schemaVersion: 'dwm.webhook_sink.acceptance.v1',
            accepted: false,
            eventId,
            receivedAt,
            error,
        }, {
            status: 400,
            headers: { 'cache-control': 'no-store' },
        })
    }

    if (context?.schemaVersion !== 'dwm.webhook.v1') {
        return NextResponse.json({
            schemaVersion: 'dwm.webhook_sink.transport_ack.v1',
            accepted: true,
            durableReceiverReceipt: false,
            eventId,
            receivedAt,
            summary: {
                eventType: context?.eventType,
                matchedTerm: webhookMatchedTerm(context),
                reviewState: record(context?.alert)?.reviewState ?? context?.reviewState,
                severity: record(context?.alert)?.severity ?? context?.severity,
            },
        }, {
            status: 202,
            headers: { 'cache-control': 'no-store' },
        })
    }

    const serviceToken = process.env.TI_SCRAPER_SERVICE_TOKEN || ''
    if (!serviceToken) {
        return unavailableReceiver(eventId, receivedAt)
    }
    let persisted: Response
    try {
        persisted = await fetch(`${authApiUrl().replace(/\/$/, '')}/findings/webhook-receiver`, {
            method: 'POST',
            cache: 'no-store',
            headers: {
                'content-type': 'application/json',
                'x-hanasand-service-token': serviceToken,
            },
            body: JSON.stringify({
                eventId,
                receivedAt,
                payload,
                payloadBody: text,
                deliveryId: request.headers.get('x-hanasand-delivery-id'),
                idempotencyKey: request.headers.get('x-hanasand-dedupe-key'),
                signature: request.headers.get('x-hanasand-delivery-signature'),
            }),
            signal: AbortSignal.timeout(12_000),
        })
    } catch {
        return unavailableReceiver(eventId, receivedAt)
    }
    const persistedPayload = await persisted.json().catch(() => null) as Record<string, unknown> | null
    if (!persisted.ok || persistedPayload?.accepted !== true || !record(persistedPayload.receipt)) {
        return unavailableReceiver(eventId, receivedAt)
    }

    return NextResponse.json({
        schemaVersion: 'dwm.webhook_sink.acceptance.v1',
        accepted: true,
        eventId,
        receivedAt,
        receipt: persistedPayload.receipt,
        summary: {
            eventType: context?.eventType,
            matchedTerm: webhookMatchedTerm(context),
            reviewState: record(context?.alert)?.reviewState ?? context?.reviewState,
            severity: record(context?.alert)?.severity ?? context?.severity,
        },
    }, {
        status: 202,
        headers: { 'cache-control': 'no-store' },
    })
}

export async function GET(request: NextRequest) {
    return proxyOrganizationApiRequest(request, '/findings/webhook-receiver', { method: 'GET' })
}

function unavailableReceiver(eventId: string, receivedAt: string) {
    return NextResponse.json({
        schemaVersion: 'dwm.webhook_sink.acceptance.v1',
        accepted: false,
        eventId,
        receivedAt,
        error: 'Durable receiver persistence is temporarily unavailable.',
    }, {
        status: 503,
        headers: { 'cache-control': 'no-store' },
    })
}
