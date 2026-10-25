import config from '@/config'
import fetchWithRetry from '@/utils/fetchWithRetry'
import { getCookie } from '../../cookies/cookies'

export default async function getVMs(id: string, tokenOverride?: string, userIdOverride?: string, impersonationToken?: string, organizationId?: string): Promise<VM[] | null> {
    try {
        const token = decodeURIComponent(tokenOverride ?? getCookie('access_token') ?? '')
        const userId = userIdOverride ?? getCookie('id')
        const browserProxy = typeof window !== 'undefined'
        const response = await fetchWithRetry(browserProxy ? `/api/backend/vms/${id}` : `${config.url.api}/vms/${id}`, {
            headers: {
                ...(browserProxy ? {} : {
                    'Authorization': `Bearer ${token}`,
                    id: userId || '',
                    ...(impersonationToken ? { 'x-impersonation-token': impersonationToken } : {}),
                    ...(organizationId ? { 'x-organization-id': organizationId } : {}),
                }),
            },
            next: { revalidate: 5 },
            timeoutMs: config.abortTimeout,
            retries: 2,
        })

        if (!response.ok) {
            throw new Error(await readResponseText(response, config.abortTimeout))
        }

        const result: unknown = JSON.parse(await readResponseText(response, config.abortTimeout))
        return Array.isArray(result) ? result as VM[] : null
    } catch {
        return null
    }
}

async function readResponseText(response: Response, timeoutMs: number): Promise<string> {
    if (!response.body) return ''

    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let size = 0
    let timedOut = false
    const timeout = setTimeout(() => {
        timedOut = true
        void reader.cancel(new Error('VM list response timed out')).catch(() => {})
    }, timeoutMs)
    try {
        while (true) {
            const { done, value } = await reader.read()
            if (done) break
            chunks.push(value)
            size += value.length
        }
        if (timedOut) throw new Error('VM list response timed out')
        const body = new Uint8Array(size)
        let offset = 0
        for (const chunk of chunks) {
            body.set(chunk, offset)
            offset += chunk.length
        }
        return new TextDecoder().decode(body)
    } finally {
        clearTimeout(timeout)
        reader.releaseLock()
    }
}
