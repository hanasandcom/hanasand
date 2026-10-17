import { requestDocker } from './client.ts'
import { parseFrameBuffer } from './logParsing.ts'
import type { DockerContainerResponse, DockerInspectResponse, RuntimeContainer, RuntimeContainerPort } from './types.ts'

function normalizeContainerName(name?: string) {
    return (name || '').replace(/^\/+/, '')
}

function normalizeHealth(status?: string) {
    return status?.match(/\(health:\s*([^)]+)\)/i)?.[1]?.trim().toLowerCase()
}

function normalizePorts(ports?: DockerContainerResponse['Ports']): RuntimeContainerPort[] {
    if (!Array.isArray(ports)) return []
    return ports
        .filter((port) => typeof port.PrivatePort === 'number')
        .map((port) => ({
            ip: port.IP,
            private_port: port.PrivatePort as number,
            public_port: typeof port.PublicPort === 'number' ? port.PublicPort : undefined,
            type: port.Type || 'tcp',
        }))
}

export async function inspectRuntimeContainer(id: string) {
    const body = await requestDocker(`/containers/${id}/json`)
    return JSON.parse(body.toString('utf8')) as DockerInspectResponse
}

export async function createRuntimeContainer(name: string, body: Record<string, unknown>, sharedName = false) {
    const healthcheck = body.Healthcheck as { Test?: unknown } | undefined
    if (!Array.isArray(healthcheck?.Test) || healthcheck.Test.length === 0 || healthcheck.Test[0] === 'NONE') {
        throw new Error('Runtime containers must define a Docker healthcheck.')
    }
    let response: Buffer
    try {
        // Image/container filesystem setup can outlast ordinary Docker reads on a busy host.
        response = await requestDocker(`/containers/create?name=${encodeURIComponent(name)}`, { method: 'POST', body, timeoutMs: 60_000 })
    } catch (error) {
        // A timed-out create may still have completed in Docker. Do not remove a
        // pre-existing container on other errors (particularly name conflicts).
        if (!sharedName && (error as NodeJS.ErrnoException).code === 'ETIMEDOUT') await removeRuntimeContainer(name).catch(() => undefined)
        throw error
    }
    const parsed = JSON.parse(response.toString('utf8')) as { Id?: string }
    if (!parsed.Id) throw new Error('Docker did not return a container id.')
    return parsed.Id
}

export async function startRuntimeContainer(id: string) {
    await requestDocker(`/containers/${encodeURIComponent(id)}/start`, { method: 'POST', timeoutMs: 60_000 })
}

export async function renameRuntimeContainer(id: string, name: string) {
    await requestDocker(`/containers/${encodeURIComponent(id)}/rename?name=${encodeURIComponent(name)}`, { method: 'POST' })
}

export async function removeRuntimeContainer(id: string) {
    await requestDocker(`/containers/${encodeURIComponent(id)}?force=1&v=1`, { method: 'DELETE', timeoutMs: 8_000 })
}

export async function getRuntimeContainer(id: string) {
    return inspectRuntimeContainer(id)
}

export async function getRuntimeContainerLogs(id: string, tail = 120) {
    const normalizedTail = Math.min(Math.max(tail, 20), 400)
    const body = await requestDocker(`/containers/${encodeURIComponent(id)}/logs?stdout=1&stderr=1&timestamps=1&tail=${normalizedTail}`)
    return parseFrameBuffer(body).join('\n').trim()
}

export async function listRuntimeContainers(): Promise<RuntimeContainer[]> {
    const body = await requestDocker('/containers/json?all=true')
    const parsed = JSON.parse(body.toString('utf8')) as DockerContainerResponse[]

    return parsed.map((container) => ({
        id: container.Id,
        name: normalizeContainerName(container.Names?.[0]) || container.Id.slice(0, 12),
        image: container.Image || 'unknown',
        state: container.State || 'unknown',
        status: container.Status || 'unknown',
        health: normalizeHealth(container.Status),
        created_at: new Date((container.Created || 0) * 1000).toISOString(),
        ports: normalizePorts(container.Ports),
    }))
}
