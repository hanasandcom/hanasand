import { searchLogs } from '../handlers/logs/search.ts'
import { getLogMetrics, getPublicLogMetrics } from '../handlers/logs/metrics.ts'
import { getLogs, getLogServices, getRealtimeLogs } from '../handlers/logs/get.ts'
import { getLogTuning, postLogTuningRefresh } from '../handlers/logs/tuning.ts'
import { getMostActiveServices } from '../handlers/logs/mostActive.ts'
import { getErrorEvents } from '../handlers/logs/errors.ts'
import ingestLog from '../handlers/logs/ingest.ts'
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

export function registerObservabilityRoutes(fastify: FastifyInstance) {
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
