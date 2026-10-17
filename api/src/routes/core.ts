import { setAuditAcknowledgment } from '../handlers/auditAcknowledgments.ts'
import { caseRepositoryWebhooks, getCaseDevelopment, getCaseRepositories, postCaseRepository, deleteCaseRepository, getCaseCommits, postCaseCommit } from '../handlers/caseDevelopment.ts'
import proxyIdentityRequest from '../utils/identityProxy.ts'
import indexHandler from '../handlers/index.ts'
import { downloadAppUpdate, downloadNamedAppUpdate, getAppUpdate, getTauriAppUpdate } from '../handlers/app/get.ts'
import { getImpersonationCurrent, getImpersonationEvents, startImpersonation, stopImpersonation } from '../handlers/impersonation.ts'
import {
    getSystemEvent,
    getSystemEvents,
    getSupportAccessRecoveryApprovals,
    getSupportAccessRecoveryApproval,
    getSupportInspection,
    getSupportReadiness,
    getSupportOrganization,
    getSupportOrganizationInvite,
    getSupportOrganizationMember,
    getSupportSession,
    getSupportUser,
    postSupportAccessRecovery,
    postSupportAccessRecoveryApprove,
    postSupportAccessRecoveryDeny,
    postSupportOrganizationMemberRoleRecovery,
    postSupportOrganizationInvite,
    postSupportOrganizationInviteAction,
    postSupportSession,
    postSupportSessionRevoke,
} from '../handlers/adminSupport.ts'

import type { FastifyInstance } from 'fastify'

export async function registerCoreRoutes(fastify: FastifyInstance) {
    // Index handler
    fastify.get('/', indexHandler)
    fastify.get('/health', async () => ({ ok: true, service: 'hanasand_api', release: process.env.HANASAND_RELEASE_COMMIT || 'unknown' }))

    // Desktop app update feed
    fastify.get('/app', getAppUpdate)
    fastify.get('/app/:target/:version', getTauriAppUpdate)
    fastify.get('/app/download', downloadAppUpdate)
    fastify.get('/app/download/:name', downloadNamedAppUpdate)

    fastify.all('/auth/*', proxyIdentityRequest)
    await fastify.register(caseRepositoryWebhooks)
    fastify.get('/cases/development', getCaseDevelopment)
    fastify.get('/cases/development/commits', getCaseCommits)
    fastify.post('/cases/development/commits', postCaseCommit)
    fastify.get('/cases/repositories', getCaseRepositories)
    fastify.post('/cases/repositories', postCaseRepository)
    fastify.delete('/cases/repositories/:id', deleteCaseRepository)

    // Impersonation
    fastify.get('/impersonation', getImpersonationCurrent)
    fastify.post('/impersonation/start', startImpersonation)
    fastify.delete('/impersonation', stopImpersonation)
    fastify.get('/impersonation/events', getImpersonationEvents)
    fastify.get('/system/events', {
        onSend: async (_req, reply, payload) => {
            const timing = [...(_req.auditBoundaryTiming || []), reply.getHeader('Server-Timing')].filter(Boolean).join(', ')
            if (timing && reply.elapsedTime >= 20) _req.log.info({ timing, elapsedMs: reply.elapsedTime }, 'Slow audit timeline request')
            reply.header('Server-Timing', `${timing ? `${timing}, ` : ''}app;dur=${reply.elapsedTime.toFixed(2)}`)
            return payload
        },
    }, getSystemEvents)
    fastify.get('/system/events/:id', getSystemEvent)
    // Compatibility aliases for existing clients; system events are the canonical name.
    fastify.get('/admin/audit-events', getSystemEvents)
    fastify.get('/admin/audit-events/:id', getSystemEvent)
    fastify.post('/admin/audit-events/:id/acknowledgment', setAuditAcknowledgment)
    fastify.delete('/admin/audit-events/:id/acknowledgment', setAuditAcknowledgment)
    fastify.get('/admin/support/readiness', getSupportReadiness)
    fastify.get('/admin/support/inspect', getSupportInspection)
    fastify.get('/admin/support/users/:id', getSupportUser)
    fastify.get('/admin/support/organizations/:id', getSupportOrganization)
    fastify.get('/admin/support/organizations/:id/invites/:inviteId', getSupportOrganizationInvite)
    fastify.get('/admin/support/organizations/:id/members/:userId', getSupportOrganizationMember)
    fastify.get('/admin/support/access-recovery', getSupportAccessRecoveryApprovals)
    fastify.get('/admin/support/access-recovery/:requestId', getSupportAccessRecoveryApproval)
    fastify.get('/admin/support/sessions/:sessionId', getSupportSession)
    fastify.post('/admin/support/sessions', postSupportSession)
    fastify.post('/admin/support/sessions/:sessionId/revoke', postSupportSessionRevoke)
    fastify.post('/admin/support/organizations/:id/invites', postSupportOrganizationInvite)
    fastify.post('/admin/support/organizations/:id/invites/:inviteId/actions', postSupportOrganizationInviteAction)
    fastify.post('/admin/support/organizations/:id/members/:userId/role-recovery', postSupportOrganizationMemberRoleRecovery)
    fastify.post('/admin/support/organizations/:id/access-recovery', postSupportAccessRecovery)
    fastify.post('/admin/support/access-recovery/:requestId/approve', postSupportAccessRecoveryApprove)
    fastify.post('/admin/support/access-recovery/:requestId/deny', postSupportAccessRecoveryDeny)

}
