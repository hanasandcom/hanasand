import systemSnapshot from '../handlers/metrics/systemSnapshot.ts'
import { getDockerStorage, clearDockerStorage } from '../handlers/dockerStorage.ts'
import { getContainerProducts, createContainerCheckout } from '../handlers/containerBilling.ts'
import { getMonitoringCases, updateMonitoringCase } from '../handlers/monitoringCases.ts'
import { postPushMonitoringEvent, postPushMonitoringKey } from '../handlers/pushMonitoring.ts'
import getMetrics from '../handlers/metrics/getMetrics.ts'
import getDatabaseOverview from '../handlers/database/getOverview.ts'
import { getDatabaseBackupDashboard, getDatabaseBackupFiles, getDatabaseBackups, postDatabaseBackup, postDatabaseBackupDelete, postDatabaseBackupRestore, postDatabaseBackupRestoreLive, postDatabaseBackupVerify } from '../handlers/database/backups.ts'
import { getDatabaseHealth, getDatabaseRows, postDatabaseQuery } from '../handlers/database/query.ts'
import getDatabaseBrowse from '../handlers/database/browse.ts'
import getDocker from '../handlers/docker/getDocker.ts'
import { getVulnerabilities, getWebScanner, postVulnerabilityScan, postWebScanner, putWebScannerSchedule } from '../handlers/vulnerabilities.ts'
import { deleteUvmTenableIntegration, getUvm, getUvmRun, postUvmAsset, postUvmAssetScan, postUvmAssetTenableScan, postUvmAssetVerification, postUvmRunCancel, putUvmAssetSchedule, putUvmFinding, putUvmTenableIntegration } from '../handlers/uvmScanner.ts'
import getStatus from '../handlers/status/get.ts'
import ingestStatus from '../handlers/status/ingest.ts'
import httpRequestTool from '../handlers/tools/httpRequest.ts'
import browserTaskTool from '../handlers/tools/browserTask.ts'
import getExecutionTargets from '../handlers/tools/getExecutionTargets.ts'
import { cancelVerificationJob, getVerificationJob, getVerificationJobs, postVerificationJob } from '../handlers/tools/verificationJobs.ts'
import {
    getLegacyBlocklistOverview,
    getLegacyTrafficDomains,
    getLegacyTrafficIps,
    getLegacyTrafficMetrics,
    getLegacyTrafficRecent,
    getLegacyTrafficRecords,
    getLegacyTrafficSummary,
    getLegacyTrafficTps,
    getLegacyTrafficUserAgents,
    getLegacyTrafficLive,
} from '../handlers/traffic/legacy.ts'
import getRateLimitSettingsHandler from '../handlers/rateLimit/getSettings.ts'
import putRateLimitSettingsHandler from '../handlers/rateLimit/putSettings.ts'
import getApiKeysHandler from '../handlers/rateLimit/getApiKeys.ts'
import postApiKeyHandler from '../handlers/rateLimit/postApiKey.ts'
import putApiKeyHandler from '../handlers/rateLimit/putApiKey.ts'
import deleteApiKeyHandler from '../handlers/rateLimit/deleteApiKey.ts'
import resetApiKeyUsageHandler from '../handlers/rateLimit/resetApiKeyUsage.ts'
import { getDesktopAgentPresence, postDesktopAgentPresence } from '../handlers/desktopAgent/presence.ts'
import { deleteAutomation, getAutomation, getAutomations, postAutomation, postAutomationRunNow, putAutomation } from '../handlers/automations.ts'
import { getSystemCronJobs, postSystemCronMonitor, putSystemCronJob } from '../handlers/systemCron.ts'
import { getCommercialContactRequests, postCommercialContactRequest } from '../handlers/commercialContactRequests.ts'
import { getAptUpdates } from '../handlers/aptUpdates.ts'
import { createBillingPortal, getBillingSubscription, receiveStripeWebhook } from '../handlers/billing.ts'

import type { FastifyInstance } from 'fastify'

export function registerPlatformOperationsRoutes(fastify: FastifyInstance) {
    // Server metrics
    fastify.get('/metrics', getMetrics)
    fastify.get('/system/snapshot', systemSnapshot)
    fastify.get('/db', getDatabaseOverview)
    fastify.get('/db/health', getDatabaseHealth)
    fastify.get('/db/rows', getDatabaseRows)
    fastify.get('/db/browse', getDatabaseBrowse)
    fastify.post('/db/query', postDatabaseQuery)
    fastify.get('/backup', getDatabaseBackups)
    fastify.get('/backup/dashboard', getDatabaseBackupDashboard)
    fastify.post('/backup', postDatabaseBackup)
    fastify.get('/backup/files', getDatabaseBackupFiles)
    fastify.post('/backup/verify', postDatabaseBackupVerify)
    fastify.post('/backup/delete', postDatabaseBackupDelete)
    fastify.post('/backup/restore', postDatabaseBackupRestore)
    fastify.post('/backup/restore-live', postDatabaseBackupRestoreLive)
    fastify.get('/status', getStatus)
    fastify.post('/status/ingest', ingestStatus)
    fastify.get('/commercial/contact-requests', getCommercialContactRequests)
    fastify.post('/commercial/contact-requests', postCommercialContactRequest)
    fastify.get('/billing/container-products', getContainerProducts)
    fastify.post('/billing/container-checkout', createContainerCheckout)
    fastify.get('/billing/subscription', getBillingSubscription)
    fastify.post('/billing/portal', createBillingPortal)
    fastify.post('/billing/webhook', receiveStripeWebhook)

    // Legacy CDN/Queenbee traffic read compatibility
    fastify.get('/traffic/summary', getLegacyTrafficSummary)
    fastify.get('/traffic/recent', getLegacyTrafficRecent)
    fastify.get('/traffic/tps', getLegacyTrafficTps)
    fastify.get('/traffic/ips', getLegacyTrafficIps)
    fastify.get('/traffic/uas', getLegacyTrafficUserAgents)
    fastify.get('/traffic/domains', getLegacyTrafficDomains)
    fastify.get('/traffic/metrics', getLegacyTrafficMetrics)
    fastify.get('/traffic/records', getLegacyTrafficRecords)
    fastify.get('/traffic/live', getLegacyTrafficLive)
    fastify.get('/blocklist/overview', getLegacyBlocklistOverview)

    // Desktop agent direct-connect discovery
    fastify.get('/desktop-agent/presence', getDesktopAgentPresence)
    fastify.post('/desktop-agent/presence', postDesktopAgentPresence)

    // Docker stats
    fastify.get('/docker', getDocker)
    fastify.get('/vulnerabilities', getVulnerabilities)
    fastify.post('/vulnerabilities/scan', postVulnerabilityScan)
    fastify.get('/vulnerabilities/web-scan', getWebScanner)
    fastify.post('/vulnerabilities/web-scan', postWebScanner)
    fastify.put('/vulnerabilities/web-scan/schedule', putWebScannerSchedule)
    fastify.get('/vulnerabilities/uvm', getUvm)
    fastify.post('/vulnerabilities/uvm/assets', postUvmAsset)
    fastify.post('/vulnerabilities/uvm/assets/:assetId/verify', postUvmAssetVerification)
    fastify.put('/vulnerabilities/uvm/assets/:assetId/schedule', putUvmAssetSchedule)
    fastify.post('/vulnerabilities/uvm/assets/:assetId/scans', postUvmAssetScan)
    fastify.post('/vulnerabilities/uvm/assets/:assetId/tenable-scans', postUvmAssetTenableScan)
    fastify.put('/vulnerabilities/uvm/integrations/tenable', putUvmTenableIntegration)
    fastify.delete('/vulnerabilities/uvm/integrations/tenable', deleteUvmTenableIntegration)
    fastify.put('/vulnerabilities/uvm/findings/:findingId', putUvmFinding)
    fastify.get('/vulnerabilities/uvm/runs/:runId', getUvmRun)
    fastify.post('/vulnerabilities/uvm/runs/:runId/cancel', postUvmRunCancel)
    fastify.get('/system/cron', getSystemCronJobs)
    fastify.post('/system/cron/monitor', postSystemCronMonitor)
    fastify.put('/system/cron/:id', putSystemCronJob)
    fastify.get('/system/updates', getAptUpdates)
    fastify.get('/system/storage', getDockerStorage)
    fastify.post('/system/storage/clear', clearDockerStorage)

    // Rate limiting
    fastify.get('/rate-limit/settings', getRateLimitSettingsHandler)
    fastify.put('/rate-limit/settings', putRateLimitSettingsHandler)
    fastify.get('/rate-limit/keys', getApiKeysHandler)
    fastify.post('/rate-limit/keys', postApiKeyHandler)
    fastify.put('/rate-limit/keys/:id', putApiKeyHandler)
    fastify.post('/rate-limit/keys/:id/reset-usage', resetApiKeyUsageHandler)
    fastify.delete('/rate-limit/keys/:id', deleteApiKeyHandler)

    // Coding tools
    fastify.get('/tools/execution-targets', getExecutionTargets)
    fastify.post('/tools/http/request', httpRequestTool)
    fastify.post('/tools/browser/task', browserTaskTool)
    fastify.get('/tools/verification-jobs', getVerificationJobs)
    fastify.post('/tools/verification-jobs', postVerificationJob)
    fastify.get('/tools/verification-jobs/:id', getVerificationJob)
    fastify.post('/tools/verification-jobs/:id/cancel', cancelVerificationJob)

    // Agent automations
    fastify.get('/cases/monitoring', getMonitoringCases)
    fastify.get('/cases/monitoring/:id', getMonitoringCases)
    fastify.patch('/cases/monitoring/:id', updateMonitoringCase)
    fastify.get('/automations', getAutomations)
    fastify.post('/automations/:id/events', postPushMonitoringEvent)
    fastify.post('/automations/:id/sender-key', postPushMonitoringKey)
    fastify.post('/automations', postAutomation)
    fastify.get('/automations/:id', getAutomation)
    fastify.put('/automations/:id', putAutomation)
    fastify.delete('/automations/:id', deleteAutomation)
    fastify.post('/automations/:id/run', postAutomationRunNow)

}
