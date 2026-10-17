import { clean } from '../../webhookValueUtils.ts'
import type { buildDwmWebhookReceiptHistoryFilters } from './receipt-history-filters.ts'

type Filters = Parameters<typeof buildDwmWebhookReceiptHistoryFilters>[0]['filters']

export function buildReceiptHistoryQuery(filters: Filters) {
    const normalizedFilters = {
        orgId: clean(filters.orgId) || null,
        destinationId: clean(filters.destinationId) || null,
        alertId: clean(filters.alertId) || null,
        casePath: clean(filters.casePath) || null,
        caseActionId: clean(filters.caseActionId) || null,
        caseActionPath: clean(filters.caseActionPath) || null,
        dedupeKey: clean(filters.dedupeKey) || null,
        requestId: clean(filters.requestId) || null,
        idempotencyKey: clean(filters.idempotencyKey) || null,
        action: clean(filters.action) || null,
        status: clean(filters.status) || null,
        timeFrom: clean(filters.timeFrom) || null,
        timeTo: clean(filters.timeTo) || null,
        retryState: clean(filters.retryState) || null,
        actorId: clean(filters.actorId) || null,
    }
    const queryPreview = {
        orgId: normalizedFilters.orgId || '<org_id>',
        destinationId: normalizedFilters.destinationId || undefined,
        alertId: normalizedFilters.alertId || undefined,
        casePath: normalizedFilters.casePath || undefined,
        caseActionId: normalizedFilters.caseActionId || undefined,
        caseActionPath: normalizedFilters.caseActionPath || undefined,
        dedupeKey: normalizedFilters.dedupeKey || undefined,
        deliveryId: normalizedFilters.requestId || undefined,
        idempotencyKey: normalizedFilters.idempotencyKey || undefined,
        action: normalizedFilters.action || undefined,
        status: normalizedFilters.status || undefined,
        timeFrom: normalizedFilters.timeFrom || undefined,
        timeTo: normalizedFilters.timeTo || undefined,
        retryState: normalizedFilters.retryState || undefined,
        actorId: normalizedFilters.actorId || undefined,
    }
    return { normalizedFilters, queryPreview }
}
