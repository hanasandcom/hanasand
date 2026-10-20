function trimSlash(value) {
    return value.replace(/\/$/, '')
}

function trimSlashes(value) {
    return String(value || '').replace(/^\/+|\/+$/g, '')
}

export const baseUrl = trimSlash(process.env.HANASAND_DB_MONITOR_BASE_URL || 'https://hanasand.com')
export const dashboardPath = (process.env.HANASAND_DB_MONITOR_PATH || '/db').replace(/^\/dashboard(?=\/)/, '')
export const serviceKey = process.env.HANASAND_DB_MONITOR_SERVICE_ACCOUNT_KEY || ''
export const apiBaseUrl = trimSlash(process.env.HANASAND_DB_MONITOR_API_BASE_URL || 'https://api.hanasand.com/api')
export const discordMention = process.env.HANASAND_DB_MONITOR_DISCORD_MENTION || '@here'
export const statePath = process.env.HANASAND_DB_MONITOR_STATE || '/home/hanasand/ops/monitoring-state/db-dashboard-monitor.json'
export const failureScreenshotPath = process.env.HANASAND_DB_MONITOR_SCREENSHOT || '/home/hanasand/ops/monitoring-state/db-dashboard-monitor-failure.png'
export const cdnBaseUrl = trimSlash(process.env.HANASAND_DB_MONITOR_CDN_BASE_URL || 'https://cdn.hanasand.com/api')
export const cdnUploadFolder = trimSlashes(process.env.HANASAND_DB_MONITOR_CDN_FOLDER || 'monitor/db-dashboard')
export const cdnUploadUser = process.env.HANASAND_DB_MONITOR_CDN_USER || ''
export const cdnUploadToken = process.env.HANASAND_DB_MONITOR_CDN_TOKEN || ''
export const timeoutMs = Number(process.env.HANASAND_DB_MONITOR_TIMEOUT_MS || 30_000)
export const failureThreshold = Math.max(Number(process.env.HANASAND_DB_MONITOR_FAILURE_THRESHOLD || 2), 1)
export const backupStatusPath = process.env.HANASAND_TI_BACKUP_STATUS || '/home/hanasand/backups/threat-intel/LATEST-STATUS'
export const backupStatePath = process.env.HANASAND_TI_BACKUP_MONITOR_STATE || '/home/hanasand/ops/monitoring-state/threat-intel-backup.json'
export const backupMaxAgeHours = Math.max(Number(process.env.HANASAND_TI_BACKUP_MAX_AGE_HOURS || 30), 1)
export const statusIngestBaseUrl = trimSlash(process.env.HANASAND_STATUS_INGEST_BASE_URL || 'https://api.hanasand.com')
export const statusIngestToken = process.env.HANASAND_STATUS_INGEST_TOKEN || ''
export const statusFeedStatePath = process.env.HANASAND_STATUS_FEED_MONITOR_STATE || '/home/hanasand/ops/monitoring-state/status-feed-monitor.json'
export const now = new Date()
