import { requestDocker } from './client.ts'
import { listRuntimeContainers } from './containers.ts'
import { parseFrameBuffer, parseLogLine } from './logParsing.ts'
import type { RuntimeLogEntry } from './types.ts'

export async function listRuntimeLogs({
    service,
    limit = 250,
    tail = 120,
    since,
}: {
    service?: string
    limit?: number
    tail?: number
    since?: string
}) {
    const normalizedLimit = Math.min(Math.max(limit, 1), 1000)
    const normalizedTail = Math.min(Math.max(tail, 20), 400)
    const containers = await listRuntimeContainers()
    const runningContainers = containers.filter((container) => container.state === 'running')
    const filteredContainers = service
        ? runningContainers.filter((container) => container.name === service || container.id.startsWith(service))
        : runningContainers

    const sinceQuery = since
        ? `&since=${Math.floor(new Date(since).getTime() / 1000)}`
        : ''

    const settled = await Promise.allSettled(filteredContainers.map(async (container) => {
        const body = await requestDocker(
            `/containers/${container.id}/logs?stdout=1&stderr=1&timestamps=1&tail=${normalizedTail}${sinceQuery}`
        )

        return parseFrameBuffer(body)
            .map((line) => parseLogLine(line, container))
            .filter((entry): entry is RuntimeLogEntry => Boolean(entry))
    }))

    const logs = settled.flatMap((result) => result.status === 'fulfilled' ? result.value : [])
    logs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    return {
        logs: logs.slice(0, normalizedLimit),
        containers: filteredContainers,
        available: true,
    }
}
