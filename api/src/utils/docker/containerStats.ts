import { requestDocker } from './client.ts'
import { inspectRuntimeContainer, listRuntimeContainers } from './containers.ts'
import type { DockerInspectResponse, DockerStatsResponse, RuntimeContainer, RuntimeContainerStats } from './types.ts'

function uptimeSeconds(startedAt?: string) {
    if (!startedAt || startedAt.startsWith('0001-01-01')) return null
    const started = new Date(startedAt).getTime()
    if (Number.isNaN(started)) return null
    return Math.max(0, Math.floor((Date.now() - started) / 1000))
}

export function parseStats(stats: DockerStatsResponse): RuntimeContainerStats {
    const cpuTotal = stats.cpu_stats?.cpu_usage?.total_usage ?? 0
    const preCpuTotal = stats.precpu_stats?.cpu_usage?.total_usage ?? 0
    const systemTotal = stats.cpu_stats?.system_cpu_usage ?? 0
    const preSystemTotal = stats.precpu_stats?.system_cpu_usage ?? 0
    const cpuDelta = cpuTotal - preCpuTotal
    const systemDelta = systemTotal - preSystemTotal
    const onlineCpus = stats.cpu_stats?.online_cpus || stats.cpu_stats?.cpu_usage?.percpu_usage?.length || 1
    const cpuPercent = typeof stats.cpu_stats?.cpu_usage?.total_usage === 'number' && typeof stats.precpu_stats?.cpu_usage?.total_usage === 'number' && cpuDelta >= 0 && systemDelta > 0
        ? (cpuDelta / systemDelta) * onlineCpus * 100
        : null

    const rawUsage = typeof stats.memory_stats?.usage === 'number' ? stats.memory_stats.usage : null
    const limit = typeof stats.memory_stats?.limit === 'number' ? stats.memory_stats.limit : null
    const cache = stats.memory_stats?.stats?.inactive_file ?? stats.memory_stats?.stats?.cache ?? 0
    const usage = rawUsage === null ? null : Math.max(0, rawUsage - cache)
    const memoryPercent = usage !== null && limit && limit > 0 ? (usage / limit) * 100 : null

    return {
        cpu_percent: cpuPercent,
        memory_bytes: usage,
        memory_limit_bytes: limit,
        memory_percent: memoryPercent,
    }
}

const previousStats = new Map<string, DockerStatsResponse>()
const liveInspections = new Map<string, { at: number; state: string; value: DockerInspectResponse }>()

async function statsRuntimeContainer(id: string, live = false) {
    if (live) {
        const body = await requestDocker(`/containers/${id}/stats?stream=false&one-shot=true`)
        const sample = JSON.parse(body.toString('utf8')) as DockerStatsResponse
        const previous = previousStats.get(id)
        previousStats.set(id, sample)
        return parseStats({ ...sample, precpu_stats: previous?.cpu_stats || sample.precpu_stats })
    }
    const body = await requestDocker(`/containers/${id}/stats?stream=false`)
    const stats = parseStats(JSON.parse(body.toString('utf8')) as DockerStatsResponse)
    if (stats.cpu_percent !== null) return stats

    await new Promise((resolve) => setTimeout(resolve, 300))
    const secondBody = await requestDocker(`/containers/${id}/stats?stream=false`)
    return parseStats(JSON.parse(secondBody.toString('utf8')) as DockerStatsResponse)
}

export async function listRuntimeContainersWithStats(live = false): Promise<RuntimeContainer[]> {
    const containers = (await listRuntimeContainers()).filter(container => !live || !['exited', 'dead', 'removing'].includes(container.state))
    const ids = new Set(containers.map(container => container.id))
    for (const id of previousStats.keys()) if (!ids.has(id)) previousStats.delete(id)
    for (const id of liveInspections.keys()) if (!ids.has(id)) liveInspections.delete(id)

    return Promise.all(containers.map(async (container) => {
        const [inspect, stats] = await Promise.allSettled([
            (async () => {
                const cached = live ? liveInspections.get(container.id) : undefined
                if (cached && cached.state === container.state && Date.now() - cached.at < 30000) return cached.value
                const value = await inspectRuntimeContainer(container.id)
                if (live) liveInspections.set(container.id, { at: Date.now(), state: container.state, value })
                return value
            })(),
            container.state === 'running'
                ? statsRuntimeContainer(container.id, live)
                : Promise.reject(new Error(`Container is ${container.state}; Docker stats are only available while running.`)),
        ])

        const inspected = inspect.status === 'fulfilled' ? inspect.value : null
        return {
            ...container,
            restart_count: inspected?.RestartCount,
            health: inspected?.State?.Health?.Status,
            uptime_seconds: uptimeSeconds(inspected?.State?.StartedAt),
            stats: stats.status === 'fulfilled' ? stats.value : null,
            stats_unavailable_reason: stats.status === 'rejected'
                ? stats.reason instanceof Error ? stats.reason.message : 'Docker stats are unavailable.'
                : undefined,
            stats_updated_at: stats.status === 'fulfilled' ? new Date().toISOString() : undefined,
        }
    }))
}
