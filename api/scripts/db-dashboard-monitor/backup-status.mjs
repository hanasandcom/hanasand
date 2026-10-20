import { backupStatusPath } from './monitor-config.mjs'

export function evaluateThreatIntelBackupStatus(text, checkedAt = new Date(), maxAgeHours = 30) {
    if (!String(text || '').trim()) {
        return backupFailure('ti_backup_missing', `Threat-intelligence backup status is missing at ${backupStatusPath}.`, 'missing', null)
    }
    const fields = parseFields(text)
    const finishedAt = fields.finished_at || null
    const finishedMs = Date.parse(finishedAt || '')
    if (fields.format !== 'hanasand.threat_intel_backup_status.v2' || !Number.isFinite(finishedMs)) {
        return backupFailure('ti_backup_invalid', 'Threat-intelligence backup status is incomplete or malformed.', fields.status || 'invalid', finishedAt)
    }
    if (fields.status !== 'succeeded' || fields.exit_code !== '0' || fields.phase !== 'complete') {
        const detail = `Threat-intelligence backup failed in ${fields.phase || 'unknown'} (${fields.reason || 'unknown'}, exit ${fields.exit_code || 'unknown'}).`
        return backupFailure('ti_backup_failed', detail, fields.status || 'failed', finishedAt)
    }
    if (!fields.archive) {
        return backupFailure('ti_backup_invalid', 'Threat-intelligence backup status is incomplete or malformed.', fields.status, finishedAt)
    }
    const ageHours = (checkedAt.getTime() - finishedMs) / 3_600_000
    if (ageHours < -5 / 60 || ageHours > maxAgeHours) {
        return backupFailure('ti_backup_stale', `Threat-intelligence backup last succeeded ${finishedAt}; expected within ${maxAgeHours} hours.`, fields.status, finishedAt)
    }
    return { ok: true, reason: 'ti_backup_ok', detail: `Threat-intelligence backup completed ${finishedAt}.`, status: fields.status, finishedAt }
}

function parseFields(text) {
    return Object.fromEntries(String(text).trim().split(/\r?\n/).map(line => line.trim()).map(line => {
        const separator = line.indexOf('=')
        return separator > 0 ? [line.slice(0, separator), line.slice(separator + 1)] : ['', '']
    }).filter(([key]) => key))
}

function backupFailure(reason, detail, status, finishedAt) {
    return { ok: false, reason, detail, status, finishedAt }
}
