import { existsSync, promises as fs } from 'node:fs'
import { promisify } from 'node:util'
import { execFile as execFileCallback } from 'node:child_process'
import config from '#constants'
import { dedupeLogs, normalizeService, toNativeEntry, type NativeLogEntry } from './nativeEntry.ts'

const execFile = promisify(execFileCallback)
const NATIVE_LOG_FILES = [
    { service: 'auth', path: '/var/log/auth.log' },
    { service: 'auth', path: '/var/log/auth.log.1' },
    { service: 'auth', path: '/var/log/secure' },
    { service: 'system', path: '/var/log/system.log' },
    { service: 'system', path: '/var/log/syslog' },
    { service: 'system', path: '/var/log/messages' },
    { service: 'kernel', path: '/var/log/kern.log' },
    { service: 'firewall', path: '/var/log/ufw.log' },
] as const

export function isNativeLogSourceAvailable() {
    return NATIVE_LOG_FILES.some((file) => existsSync(file.path))
        || existsSync('/bin/journalctl')
        || existsSync('/usr/bin/journalctl')
        || existsSync('/run/log/journal')
        || existsSync('/var/log/journal')
        || Boolean(config.internal_api && config.vm_api_token)
}

async function readTail(path: string, maxBytes = 256 * 1024) {
    const handle = await fs.open(path, 'r')
    try {
        const stat = await handle.stat()
        const start = Math.max(0, stat.size - maxBytes)
        const length = stat.size - start
        const buffer = Buffer.alloc(length)
        await handle.read(buffer, 0, length, start)
        return buffer.toString('utf8')
    } finally {
        await handle.close()
    }
}

async function listFileLogs(limit: number) {
    const entries: NativeLogEntry[] = []
    for (const file of NATIVE_LOG_FILES) {
        if (!existsSync(file.path)) continue
        try {
            const content = await readTail(file.path)
            const lines = content.split('\n').filter(Boolean).slice(-limit)
            for (const line of lines) {
                const match = line.match(/^([A-Z][a-z]{2}\s+\d+\s+\d{2}:\d{2}:\d{2})\s+(\S+)\s+([^:]+):\s*(.*)$/)
                if (!match) continue
                const [, timestamp, host, identifier, message] = match
                const createdAt = new Date(`${new Date().getFullYear()} ${timestamp}`).toISOString()
                const service = normalizeService(identifier.split('[')[0], file.service)
                const entry = toNativeEntry({
                    service,
                    host,
                    message,
                    createdAt,
                    metadata: { native_source: 'file', file_path: file.path, identifier },
                })
                if (entry) entries.push(entry)
            }
        } catch {
            // Best-effort native log collection should not fail the request.
        }
    }
    return entries
}

async function listJournalLogs(limit: number) {
    try {
        const { stdout } = await execFile('journalctl', ['-n', String(limit), '--no-pager', '-o', 'json'], { timeout: 2000 })
        const entries: NativeLogEntry[] = []
        for (const line of stdout.split('\n').filter(Boolean)) {
            try {
                const parsed = JSON.parse(line) as Record<string, unknown>
                const message = String(parsed.MESSAGE || '').trim()
                if (!message) continue
                const service = normalizeService(String(parsed._SYSTEMD_UNIT || parsed.SYSLOG_IDENTIFIER || parsed.COMM || ''), 'systemd')
                const entry = toNativeEntry({
                    service,
                    host: String(parsed._HOSTNAME || 'localhost'),
                    message,
                    createdAt: typeof parsed.__REALTIME_TIMESTAMP === 'string'
                        ? new Date(Number(parsed.__REALTIME_TIMESTAMP) / 1000).toISOString()
                        : typeof parsed._SOURCE_REALTIME_TIMESTAMP === 'string'
                            ? new Date(Number(parsed._SOURCE_REALTIME_TIMESTAMP) / 1000).toISOString()
                            : null,
                    priority: parsed.PRIORITY as string | number | null,
                    metadata: { native_source: 'journalctl', unit: parsed._SYSTEMD_UNIT, identifier: parsed.SYSLOG_IDENTIFIER, pid: parsed._PID },
                })
                if (entry) entries.push(entry)
            } catch {
                // Skip malformed journal rows.
            }
        }
        return entries
    } catch {
        return []
    }
}

export async function listLocalNativeLogs({ service, level, search, limit = 200 }: {
    service?: string | null
    level?: string | null
    search?: string | null
    limit?: number
}) {
    const normalizedLimit = Math.min(Math.max(limit, 1), 500)
    const [journalLogs, fileLogs] = await Promise.all([listJournalLogs(normalizedLimit), listFileLogs(normalizedLimit)])
    const needle = (search || '').trim().toLowerCase()
    const logs = dedupeLogs([...journalLogs, ...fileLogs])
        .filter((entry) => !service || entry.service === service)
        .filter((entry) => !level || entry.level === level)
        .filter((entry) => !needle
            || entry.message.toLowerCase().includes(needle)
            || entry.service.toLowerCase().includes(needle)
            || String(entry.metadata.identifier || '').toLowerCase().includes(needle))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    return logs.slice(0, normalizedLimit)
}
