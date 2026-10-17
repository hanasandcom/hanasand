import { searchLogs } from '../handlers/logs/search.ts'
import { getLogMetrics, getPublicLogMetrics } from '../handlers/logs/metrics.ts'
import { getLogs, getLogServices, getRealtimeLogs } from '../handlers/logs/get.ts'
import { getLogTuning, postLogTuningRefresh } from '../handlers/logs/tuning.ts'
import { getMostActiveServices } from '../handlers/logs/mostActive.ts'
import { getErrorEvents } from '../handlers/logs/errors.ts'
import ingestLog from '../handlers/logs/ingest.ts'
import getAiWorkspace from '../handlers/ai/getWorkspace.ts'
import getAiRuntime from '../handlers/ai/getRuntime.ts'
import postAiConversation from '../handlers/ai/postConversation.ts'
import putAiConversation from '../handlers/ai/putConversation.ts'
import deleteAiConversation from '../handlers/ai/deleteConversation.ts'
import upsertAiMessage from '../handlers/ai/upsertMessage.ts'
import postAiRepository from '../handlers/ai/postRepository.ts'
import { getModelHealth, getInferenceHealth } from '../handlers/ai/health.ts'
import getAiModels from '../handlers/ai/getModels.ts'
import importRepository from '../handlers/ai/importRepository.ts'
import { getGitWorkspaceStatus, postGitWorkspaceCommit, postGitWorkspacePull, postGitWorkspacePush } from '../handlers/ai/gitWorkspace.ts'
import putRepositoryCredential from '../handlers/ai/putRepositoryCredential.ts'
import deleteRepositoryCredential from '../handlers/ai/deleteRepositoryCredential.ts'
import { getAiDeployments, postAiDeployment } from '../handlers/ai/deployments.ts'
import { getAiEconomics } from '../handlers/ai/economics.ts'
import { deleteAiConversationCollaborator, postAiConversationCollaborator } from '../handlers/ai/collaborators.ts'
import { getAiReleases, getAiReleaseSupportBundle, postAiRollback } from '../handlers/ai/releases.ts'
import { getAiPreview } from '../handlers/ai/preview.ts'
import getMailOverview from '../handlers/mail/getOverview.ts'
import relayHealth from '../handlers/mail/relayHealth.ts'
import postSendMail from '../handlers/mail/postSend.ts'
import postMailAction from '../handlers/mail/postAction.ts'
import postMailbox from '../handlers/mail/postMailbox.ts'
import postMailFilter from '../handlers/mail/postFilter.ts'
import deleteMailFilter from '../handlers/mail/deleteFilter.ts'
import getMailBlob from '../handlers/mail/getBlob.ts'
import { postRulePreview, getEvents, getRule, putRule, getRules, getRuleHitCounts, getRuleHitCount, getRuleStorageEstimate, postEventAction, postRule, postRuleAction, postRulePack, postEventSigmaPack } from '../handlers/events.ts'
import { getRuleReprocess, postRuleReprocess } from '../handlers/ruleReprocess.ts'

import type { FastifyInstance } from 'fastify'

export function registerAiAndObservabilityRoutes(fastify: FastifyInstance) {
    // AI workspace
    fastify.get('/ai/workspace', getAiWorkspace)
    fastify.get('/ai/runtime', getAiRuntime)
    fastify.get('/ai/economics', getAiEconomics)
    fastify.get('/ai/models', getAiModels)
    fastify.get('/ai/health/models', getModelHealth)
    fastify.get('/ai/health/inference', getInferenceHealth)
    fastify.get('/ai/previews/:id', getAiPreview)
    fastify.get('/ai/previews/:id/*', getAiPreview)
    fastify.post('/ai/import-repository', importRepository)
    fastify.post('/ai/conversations', postAiConversation)
    fastify.put('/ai/conversations/:id', putAiConversation)
    fastify.delete('/ai/conversations/:id', deleteAiConversation)
    fastify.post('/ai/conversations/:id/collaborators', postAiConversationCollaborator)
    fastify.delete('/ai/conversations/:id/collaborators/:userId', deleteAiConversationCollaborator)
    fastify.put('/ai/conversations/:id/messages', upsertAiMessage)
    fastify.post('/ai/repositories', postAiRepository)
    fastify.get('/ai/repositories/:id/git/status', getGitWorkspaceStatus)
    fastify.post('/ai/repositories/:id/git/pull', postGitWorkspacePull)
    fastify.post('/ai/repositories/:id/git/commit', postGitWorkspaceCommit)
    fastify.post('/ai/repositories/:id/git/push', postGitWorkspacePush)
    fastify.get('/ai/deployments', getAiDeployments)
    fastify.post('/ai/deployments', postAiDeployment)
    fastify.get('/ai/releases', getAiReleases)
    fastify.get('/ai/releases/:id/support-bundle', getAiReleaseSupportBundle)
    fastify.post('/ai/releases/:id/rollback', postAiRollback)
    fastify.put('/ai/repositories/:id/credentials/github', putRepositoryCredential)
    fastify.delete('/ai/repositories/:id/credentials/github', deleteRepositoryCredential)

    // Mail
    fastify.get('/mail/overview', getMailOverview)
    fastify.get('/mail-relay/:site/health', relayHealth)
    fastify.post('/mail/send', postSendMail)
    fastify.post('/mail/mailboxes', postMailbox)
    fastify.post('/mail/message/:id/action', postMailAction)
    fastify.post('/mail/filters', postMailFilter)
    fastify.delete('/mail/filters/:id', deleteMailFilter)
    fastify.get('/mail/blob/:mailboxUser/:blobId/:name', getMailBlob)

    // Logs
    fastify.get('/logs', getLogs)
    fastify.get('/logs/tuning', getLogTuning)
    fastify.post('/logs/tuning/refresh', postLogTuningRefresh)
    fastify.get('/logs/errors', getErrorEvents)
    fastify.get('/logs/services', getLogServices)
    fastify.get('/logs/services/summary', getMostActiveServices)
    fastify.get('/logs/realtime', getRealtimeLogs)
    fastify.post('/logs/ingest', ingestLog)
    fastify.get('/logs/search', searchLogs)
    fastify.get('/logs/metrics', getLogMetrics)
    fastify.get('/logs/metrics/public', getPublicLogMetrics)

    // Events and rules
    fastify.get('/events', getEvents)
    fastify.post('/events/:id/actions', postEventAction)
    fastify.get('/rules', getRules)
    fastify.get('/rules/hits', getRuleHitCounts)
    fastify.get('/rules/:id/hits', getRuleHitCount)
    fastify.get('/rules/:id/storage-estimate', getRuleStorageEstimate)
    fastify.get('/rules/:id', getRule)
    fastify.put('/rules/:id', putRule)
    fastify.post('/rules', postRule)
    fastify.post('/rules/preview', postRulePreview)
    fastify.post('/rules/packs', postRulePack)
    fastify.post('/rules/sigma', postEventSigmaPack)
    fastify.post('/rules/:id/actions', postRuleAction)
    fastify.get('/rules/:id/reprocess', getRuleReprocess)
    fastify.post('/rules/:id/reprocess', postRuleReprocess)
}
