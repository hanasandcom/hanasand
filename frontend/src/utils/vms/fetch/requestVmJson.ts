import config from '@/config'
import fetchWithRetry from '@/utils/fetchWithRetry'

export async function requestVmJson<T>(path: string, token: string, userId: string): Promise<T> {
    const response = await fetchWithRetry(`${config.url.api}${path}`, {
        headers: { Authorization: `Bearer ${token}`, id: userId },
        timeoutMs: config.abortTimeout,
        retries: 2,
    })

    if (!response.ok) {
        throw new Error(await response.text())
    }

    return await response.json() as T
}
