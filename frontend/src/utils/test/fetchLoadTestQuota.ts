import config from '@/config'
import { getCookie } from 'hanasand/cookies'
import { getOrCreateLoadTestClientId } from './postTest'

export async function fetchLoadTestQuota(): Promise<LoadTestQuota | null> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), Math.max(config.abortTimeout, 10000))

    try {
        const headers = new Headers()
        const id = getCookie('id')
        if (id) {
            headers.set('id', id)
        } else {
            headers.set('x-load-test-client-id', getOrCreateLoadTestClientId())
        }

        const response = await fetch(`${config.url.api}/tests/quota`, { headers, signal: controller.signal })
        if (!response.ok) return null
        return await response.json() as LoadTestQuota
    } catch {
        return null
    } finally {
        clearTimeout(timeout)
    }
}
