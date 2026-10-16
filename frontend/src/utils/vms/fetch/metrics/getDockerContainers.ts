import config from '@/config'
import fetchWithRetry from '@/utils/fetchWithRetry'
import { responseErrorMessage } from './responseErrorMessage'

type DockerContainerStats = {
    id: string
    token: string
}

export default async function getDockerContainers({ id, token }: DockerContainerStats): Promise<DockerTelemetryResponse> {
    try {
        const response = await fetchWithRetry(`${config.url.api}/docker`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                id
            },
            next: { revalidate: 5 },
            timeoutMs: config.abortTimeout,
            retries: 2,
        })

        if (!response.ok) {
            throw new Error(await responseErrorMessage(response, 'Docker telemetry'))
        }

        const data = await response.json()
        if (Array.isArray(data)) {
            return { containers: data as DockerContainer[], source: 'legacy_array', generated_at: new Date().toISOString() }
        }

        const payload = data?.data && typeof data.data === 'object' && !Array.isArray(data.data)
            ? data.data
            : data
        const containers = Array.isArray(payload?.containers)
            ? payload.containers
            : Array.isArray(data?.data)
                ? data.data
                : []

        return {
            containers: containers as DockerContainer[],
            source: typeof payload?.source === 'string' ? payload.source : undefined,
            docker_socket_available: typeof payload?.docker_socket_available === 'boolean' ? payload.docker_socket_available : undefined,
            unavailable_reason: typeof payload?.unavailable_reason === 'string' ? payload.unavailable_reason : undefined,
            generated_at: typeof payload?.generated_at === 'string' ? payload.generated_at : new Date().toISOString(),
        }
    } catch (error) {
        return {
            containers: [],
            source: 'unavailable',
            unavailable_reason: error instanceof Error ? error.message : 'Docker telemetry is unavailable.',
            generated_at: new Date().toISOString(),
        }
    }
}
