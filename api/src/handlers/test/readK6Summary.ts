import { readFile, unlink } from 'node:fs/promises'

export default async function readK6Summary(summaryPath: string) {
    try {
        const content = await readFile(summaryPath, 'utf8')
        await unlink(summaryPath).catch(() => undefined)
        const payload = JSON.parse(content)
        const duration = metricValues(payload.metrics?.http_req_duration)
        const failed = metricValues(payload.metrics?.http_req_failed)
        const requests = metricValues(payload.metrics?.http_reqs)
        const checks = metricValues(payload.metrics?.checks)

        return {
            requests: requests.count || 0,
            checks: checks.passes || 0,
            failures: checks.fails || 0,
            failureRate: failed.rate ?? failed.value ?? 0,
            duration: {
                avg: duration.avg || 0,
                med: duration.med || 0,
                p90: duration['p(90)'] || 0,
                p95: duration['p(95)'] || 0,
                max: duration.max || 0,
            },
        }
    } catch {
        return {}
    }
}

function metricValues(metric: Record<string, number> & { values?: Record<string, number> } | undefined) {
    return metric?.values || metric || {}
}
