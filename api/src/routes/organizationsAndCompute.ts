import assignVmOrganization from '../handlers/vms/organization.ts'
import getHostOverview from '../handlers/hostOverview.ts'
import proxyIdentityRequest from '../utils/identityProxy.ts'
import getCertificate from '../handlers/certificates/get.ts'
import postCertificate from '../handlers/certificates/post.ts'
import putCertificate from '../handlers/certificates/put.ts'
import deleteCertificate from '../handlers/certificates/delete.ts'
import getUserCertificates from '../handlers/certificates/getUserCertificates.ts'
import getVM from '../handlers/vms/get.ts'
import postVM from '../handlers/vms/post.ts'
import provisionVmInternal from '../handlers/vms/provisionInternal.ts'
import getInternalVmStatus from '../handlers/vms/statusInternal.ts'
import vmActionInternal from '../handlers/vms/actionInternal.ts'
import getAccessibleVMs from '../handlers/vms/getAccessibleVMs.ts'
import deleteVM, { restoreVM } from '../handlers/vms/delete.ts'
import getVMMetrics from '../handlers/vms/metrics/get.ts'
import postVMMetrics from '../handlers/vms/metrics/post.ts'
import putVMMetrics from '../handlers/vms/metrics/put.ts'
import deleteVMMetrics from '../handlers/vms/metrics/delete.ts'
import getVMNames from '../handlers/vms/getNames.ts'
import postVMDetails from '../handlers/vms/postVMDetails.ts'
import deleteVMs from '../handlers/vms/deleteVMs.ts'
import shutdownVMs from '../handlers/vms/shutdown.ts'
import getVMDetails from '../handlers/vms/getVMDetails.ts'
import getVmConnection from '../handlers/vms/getConnection.ts'
import getAgentTarget from '../handlers/vms/getAgentTarget.ts'
import getAgentTargets from '../handlers/vms/getAgentTargets.ts'
import postAgentTargetSyncAccess from '../handlers/vms/postAgentTargetSyncAccess.ts'
import postAgentTargetRequest from '../handlers/vms/postAgentTargetRequest.ts'
import stopVms from '../handlers/vms/stopVms.ts'
import putVmHostFeatures from '../handlers/vms/putHostFeatures.ts'
import postVmFailover from '../handlers/vms/postFailover.ts'
import vmAction from '../handlers/vms/action.ts'
import { deleteProject, deleteShare, getProject, getShare, getShareTree, getUserProjects, getUserShares, postShare, putShare, setShareLock } from '../handlers/share.ts'
import {
    deleteOrganizationWatchlist,
    deleteOrganizationApiKey,
    deleteOrganizationMember,
    getOrganization,
    getOrganizationApiKeys,
    getOrganizationAlertCaseVisibility,
    getOrganizationAlertReadiness,
    getOrganizationInvites,
    getOrganizationMembers,
    getOrganizationSettings,
    getOrganizationWatchlist,
    getOrganizationWatchlistAlertTerms,
    getOrganizationWatchlists,
    postOrganization,
    postOrganizationApiKey,
    postOrganizationInviteAccept,
    postOrganizationInviteAction,
    postOrganizationInvites,
    postOrganizationOwnershipTransfer,
    postOrganizationWatchlist,
    postOrganizationWatchlistAction,
    postOrganizationWatchlistCleanup,
    patchOrganizationMemberRole,
    putOrganizationSettings,
    putOrganizationWatchlist,
} from '../handlers/organizations.ts'
import { getOrganizationPrivacy, postOrganizationPrivacy } from '../handlers/organizationPrivacy.ts'

import type { FastifyInstance } from 'fastify'

export function registerOrganizationsAndComputeRoutes(fastify: FastifyInstance) {
    // Organizations
    fastify.get('/management/organizations', proxyIdentityRequest)
    fastify.get('/organizations', proxyIdentityRequest)
    fastify.post('/organizations', postOrganization)
    fastify.post('/organizations/invites/:inviteId/accept', postOrganizationInviteAccept)
    fastify.get('/organizations/:id/invites', getOrganizationInvites)
    fastify.post('/organizations/:id/invites', postOrganizationInvites)
    fastify.post('/organizations/:id/invites/:inviteId/actions', postOrganizationInviteAction)
    fastify.get('/organizations/:id/members', getOrganizationMembers)
    fastify.patch('/organizations/:id/members/:userId/role', patchOrganizationMemberRole)
    fastify.delete('/organizations/:id/members/:userId', deleteOrganizationMember)
    fastify.post('/organizations/:id/ownership-transfer', postOrganizationOwnershipTransfer)
    fastify.get('/organizations/:id/settings', getOrganizationSettings)
    fastify.put('/organizations/:id/settings', putOrganizationSettings)
    fastify.get('/organizations/:id/api-keys', getOrganizationApiKeys)
    fastify.post('/organizations/:id/api-keys', postOrganizationApiKey)
    fastify.delete('/organizations/:id/api-keys/:keyId', deleteOrganizationApiKey)
    fastify.get('/organizations/:id/privacy', getOrganizationPrivacy)
    fastify.post('/organizations/:id/privacy', postOrganizationPrivacy)
    fastify.get('/organizations/:id/alert-readiness', getOrganizationAlertReadiness)
    fastify.get('/organizations/:id/alert-case-visibility', getOrganizationAlertCaseVisibility)
    fastify.get('/organizations/:id/watchlists/alert-terms', getOrganizationWatchlistAlertTerms)
    fastify.get('/organizations/:organizationId/watchlists/:itemId', getOrganizationWatchlist)
    fastify.get('/organizations/:id/watchlists', getOrganizationWatchlists)
    fastify.post('/organizations/:id/watchlists', postOrganizationWatchlist)
    fastify.post('/organizations/:id/watchlists/cleanup', postOrganizationWatchlistCleanup)
    fastify.put('/organizations/:organizationId/watchlists/:itemId', putOrganizationWatchlist)
    fastify.post('/organizations/:organizationId/watchlists/:itemId/actions', postOrganizationWatchlistAction)
    fastify.delete('/organizations/:organizationId/watchlists/:itemId', deleteOrganizationWatchlist)
    fastify.get('/organizations/:id', getOrganization)

    // Share workspaces
    fastify.get('/share/tree/:id', getShareTree)
    fastify.get('/share/user/:id', getUserShares)
    fastify.put('/share/lock/:id', setShareLock)
    fastify.get('/share/:id', getShare)
    fastify.post('/share', postShare)
    fastify.put('/share/:id', putShare)
    fastify.delete('/share/:id', deleteShare)
    fastify.get('/projects/user/:id', getUserProjects)
    fastify.get('/project/:alias', getProject)
    fastify.delete('/project/:alias', deleteProject)

    // Certificates
    fastify.get('/certificates/:id', getCertificate)
    fastify.get('/certificates/user/:id', getUserCertificates)
    fastify.post('/certificates', postCertificate)
    fastify.put('/certificates/:id', putCertificate)
    fastify.delete('/certificates/:id', deleteCertificate)

    // Host SSH access
    fastify.get('/host-overview', getHostOverview)

    // Vms
    fastify.get('/vms/agent/targets', getAgentTargets)
    fastify.get('/vm/metrics', getVMMetrics)
    fastify.get('/vm/metrics/:id', getVMMetrics)
    fastify.post('/vm/metrics', postVMMetrics)
    fastify.put('/vm/metrics/:id', putVMMetrics)
    fastify.delete('/vm/metrics/:id', deleteVMMetrics)
    fastify.get('/vm/:id/agent-target', getAgentTarget)
    fastify.post('/vm/:id/agent-target/sync-access', postAgentTargetSyncAccess)
    fastify.post('/vm/:id/request', postAgentTargetRequest)
    fastify.get('/vm/:id', getVM)
    fastify.get('/vm/:id/connection', getVmConnection)
    fastify.put('/vm/:id/host-features', putVmHostFeatures)
    fastify.post('/vm/:id/failover', postVmFailover)
    fastify.get('/vm/details/:name', getVMDetails)
    fastify.get('/vms', getVM)
    fastify.get('/vms/stop', stopVms)
    fastify.get('/vms/names', getVMNames)
    fastify.get('/vms/:user', getVM)
    fastify.get('/vms/access/:user', getAccessibleVMs)
    fastify.put('/vm/:id/organization', assignVmOrganization)
    fastify.post('/vm', postVM)
    fastify.post('/vms/internal/:name/provision', provisionVmInternal)
    fastify.get('/vms/internal/:name/status', getInternalVmStatus)
    fastify.post('/vms/internal/:name/:action', vmActionInternal)
    fastify.post('/vm/:id/:action', vmAction)
    fastify.post('/vm/details', postVMDetails)
    fastify.post('/vms/shutdown', shutdownVMs)
    fastify.post('/vms/stop', stopVms)
    fastify.post('/vm/:id/restore', restoreVM)
    fastify.delete('/vm/:id', deleteVM)
    fastify.delete('/vms', deleteVMs)

}
