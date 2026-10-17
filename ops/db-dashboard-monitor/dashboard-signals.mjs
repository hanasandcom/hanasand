export function evaluateDashboardText(text, inventory = {}) {
    const lines = linesFromText(text)
    const fullText = lines.join('\n')
    const unavailablePattern = /Database telemetry is reconnecting|Database metrics unavailable|Query telemetry unavailable|Inventory stream retrying|Cluster stream retrying|Missing system_admin|Unauthorized/i
    const unavailableMatch = fullText.match(unavailablePattern)
    const metrics = {
        clusters: inventory.clusters == null ? parseIntegerMetric(lines, 'Clusters') : Number(inventory.clusters),
        databases: inventory.databases == null ? parseIntegerMetric(lines, 'DBs') ?? parseIntegerMetric(lines, 'Databases') : Number(inventory.databases),
        storageBytes: inventory.storageBytes == null ? parseStorageMetric(lines, 'Storage') : Number(inventory.storageBytes),
        activeQueries: parseIntegerMetric(lines, 'Active queries'),
        longRunning: parseIntegerMetric(lines, 'Long-running'),
    }

    if (unavailableMatch) return failure('db_dashboard_unavailable', `Database dashboard showed unavailable state: ${unavailableMatch[0]}.`, metrics)
    if (metrics.clusters === null || metrics.clusters < 1) return failure('db_dashboard_missing_clusters', 'Database dashboard did not show at least one PostgreSQL cluster.', metrics)
    if (metrics.databases === null || metrics.databases < 1) return failure('db_dashboard_missing_databases', 'Database dashboard did not show at least one database.', metrics)
    if (metrics.storageBytes === null || metrics.storageBytes <= 0) return failure('db_dashboard_missing_storage', 'Database dashboard did not show non-zero PostgreSQL storage.', metrics)
    if (!/Long-running query state|No long-running queries right now|Long-running|Longest running query/i.test(fullText)) {
        return failure('db_dashboard_missing_query_state', 'Database dashboard did not show an explicit long-running query state.', metrics)
    }

    return {
        ok: true,
        reason: 'db_dashboard_ok',
        detail: `Database dashboard live: ${metrics.clusters} cluster(s), ${metrics.databases} database(s), ${formatBytes(metrics.storageBytes)} storage.`,
        metrics,
    }
}

function failure(reason, detail, metrics) {
    return { ok: false, reason, detail, metrics }
}

function linesFromText(text) {
    return String(text || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean)
}

function parseIntegerMetric(lines, label) {
    const value = metricValue(lines, label) || (label === 'Databases' ? metricValue(lines, 'DBs') : null)
    if (!value) return null
    const parsed = Number(value.replace(/,/g, ''))
    return Number.isFinite(parsed) ? parsed : null
}

function parseStorageMetric(lines, label) {
    const value = metricValue(lines, label)
    if (!value) return null
    const match = value.match(/^([\d.]+)\s*(B|KB|MB|GB|TB)$/i)
    if (!match) return null
    const amount = Number(match[1])
    const unit = match[2].toUpperCase()
    const multiplier = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3, TB: 1024 ** 4 }[unit]
    return Number.isFinite(amount) ? amount * multiplier : null
}

function metricValue(lines, label) {
    const index = lines.findIndex(line => line.toLowerCase() === label.toLowerCase())
    return index === -1 ? null : lines[index + 1] || null
}

export function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    let value = bytes
    let index = 0
    while (value >= 1024 && index < units.length - 1) {
        value /= 1024
        index++
    }
    return `${value.toFixed(index === 0 ? 0 : 2)} ${units[index]}`
}
