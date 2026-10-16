import type { FastifyRequest } from 'fastify'
import {
    normalizeOption,
    supportError,
    supportInspectionQueryFilters,
    supportRequestId,
} from '#utils/support/adminSupportInput.ts'
import { recordSystemEvent } from '#utils/systemEvent.ts'
import { loadSupportSessionState } from '#utils/support/supportSessionState.ts'
import { supportActionPreparationInput, type SupportActionPreparationInput } from './inspectionActionPreparation.ts'
import { supportInspectionFilterError } from './inspectionFilterValidation.ts'

export type SupportInspectionQuery = {
    q?: string
    org?: string
    orgId?: string
    user?: string
    userId?: string
    email?: string
    request?: string
    requestId?: string
    entity?: string
    entityId?: string
    entityType?: string
    session?: string
    supportSession?: string
    supportSessionId?: string
    workflow?: string
    bridgeWorkflow?: string
    sourceWorkflow?: string
    action?: string
    severity?: string
    outcome?: string
    source?: string
    service?: string
    blocker?: string
    blockerCode?: string
    prepareAction?: string
    reason?: string
    supportReason?: string
    supportScope?: string
    context?: string
    supportContext?: string
    scope?: string
    idempotencyKey?: string
    idempotency_key?: string
    durationMinutes?: string
    duration_minutes?: string
    expiresAt?: string
    expires_at?: string
    from?: string
    to?: string
    limit?: string
}

type SupportInspectionFilters = ReturnType<typeof supportInspectionQueryFilters>
type SessionState = Awaited<ReturnType<typeof loadSupportSessionState>>

export type SupportInspectionRequest = {
    actorId: string
    query: SupportInspectionQuery
    filters: SupportInspectionFilters
    requestedOrg: string
    requestedUser: string
    email: string
    requestedRequest: string
    requestedEntity: string
    org: string
    user: string
    request: string
    entity: string
    prepareAction: string
    sessionState: SessionState
    supportSession: string
    inspectionRequestId: string
    preparationInput: SupportActionPreparationInput | null
}

type RequestResult = { value: SupportInspectionRequest } | { status: 400 | 403 | 404, body: Record<string, unknown> }

export async function prepareSupportInspectionRequest(req: FastifyRequest, actorId: string): Promise<RequestResult> {
    const query = req.query as SupportInspectionQuery
    const filters = supportInspectionQueryFilters(query)
    const {
        org: requestedOrg,
        user: requestedUser,
        email,
        request: requestedRequest,
        entity: requestedEntity,
        supportSession,
    } = filters
    const prepareAction = normalizeOption(query.prepareAction, ['invite_assist', 'access_recovery', 'impersonation'])
    const sessionState = supportSession ? await loadSupportSessionState(supportSession) : null
    const inspectionRequestId = supportRequestId(req)

    if (supportSession && !sessionState) {
        return {
            status: 404,
            body: supportError('support_session_not_found', 'Support session not found.', { supportSessionId: supportSession }),
        }
    }
    if (sessionState) {
        const orgMismatch = Boolean(requestedOrg && sessionState.organizationId && requestedOrg !== sessionState.organizationId)
        const userMismatch = Boolean(requestedUser && sessionState.targetUserId && requestedUser !== sessionState.targetUserId)
        if (orgMismatch || userMismatch) {
            const blocker = orgMismatch ? 'support_session_org_mismatch' : 'support_session_user_mismatch'
            await recordSystemEvent(req, {
                actionType: 'support.inspect',
                actorId,
                targetType: 'support_session',
                targetId: supportSession,
                organizationId: sessionState.organizationId || requestedOrg || null,
                entityId: supportSession,
                requestId: inspectionRequestId,
                severity: 'warning',
                outcome: 'denied',
                reason: sessionState.reason || undefined,
                context: {
                    schemaVersion: 'support.inspection.session_scope_guard.v1',
                    supportSessionId: supportSession,
                    requestedOrg: requestedOrg || null,
                    requestedUser: requestedUser || null,
                    scopedOrg: sessionState.organizationId || null,
                    scopedUser: sessionState.targetUserId || null,
                    blockerCode: blocker,
                    noCrossOrgLeakage: true,
                    redactionRequired: true,
                },
            })
            return {
                status: 403,
                body: supportError(blocker, 'Support session scope does not allow this inspection target.', {
                    supportSessionId: supportSession,
                    requestedOrg: requestedOrg || null,
                    requestedUser: requestedUser || null,
                    scopedOrg: sessionState.organizationId || null,
                    scopedUser: sessionState.targetUserId || null,
                    noCrossOrgLeakage: true,
                }),
            }
        }
    }

    const org = sessionState?.organizationId || requestedOrg || ''
    const user = sessionState?.targetUserId || requestedUser || ''
    const request = requestedRequest || sessionState?.requestId || ''
    const entity = requestedEntity || supportSession
    const filterError = supportInspectionFilterError(query, { ...filters, org, user, request, entity })
    if (filterError) return { status: 400, body: filterError }

    const preparation = supportActionPreparationInput(query, prepareAction)
    if (preparation.error) return { status: 400, body: preparation.error }
    const hasTarget = Boolean(filters.q || org || user || email || request || entity || filters.entityType || supportSession || filters.workflow || filters.action || filters.blocker || filters.reason || filters.scope || filters.context)
    if (!hasTarget) {
        return {
            status: 400,
            body: supportError('missing_support_target', 'Add q, org, user, email, request, entity, entityType, supportSession, workflow, action, blocker, reason, scope, or context to inspect support state.'),
        }
    }

    return {
        value: {
            actorId,
            query,
            filters,
            requestedOrg,
            requestedUser,
            email,
            requestedRequest,
            requestedEntity,
            org,
            user,
            request,
            entity,
            prepareAction,
            sessionState,
            supportSession,
            inspectionRequestId,
            preparationInput: preparation.value,
        },
    }
}
