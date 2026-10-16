import type { FastifyRequest } from 'fastify'
import type { AccessRecoveryApprovalRow } from '../supportTypes.ts'

export type AccessRecoveryDecisionParams = { requestId: string }

export type SupportAccessRecoveryDecisionBody = {
    reason?: unknown
    context?: unknown
    supportSessionId?: unknown
    support_session_id?: unknown
}

export type AccessRecoveryDecision = 'approved' | 'denied'

export type AccessRecoveryDecisionRequest = FastifyRequest<{
    Params: AccessRecoveryDecisionParams
    Body: SupportAccessRecoveryDecisionBody
}>

export type DecisionReceiptContext = {
    actorId: string
    decision: AccessRecoveryDecision
    reason: string
    supportSessionId: string
    requiredScope: string
}

export type DecisionFailureCurrent = AccessRecoveryApprovalRow
