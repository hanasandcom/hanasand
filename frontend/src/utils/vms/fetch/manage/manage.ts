import config from '@/config'
import fetchWithRetry from '@/utils/fetchWithRetry'
import { getCookie } from '@/utils/cookies/cookies'

export type VMActionResult = { ok: true, message: string } | { ok: false, message: string }

export default async function manageVM(id: string, action: 'start' | 'stop' | 'restart'): Promise<VMActionResult> {
    try {
        if (!id.trim()) {
            return { ok: false, message: 'This virtual machine is missing its instance name.' }
        }

        const token = getCookie('access_token')
        const userId = getCookie('id')
        if (!token || !userId) {
            return { ok: false, message: 'Please log in to manage VMs.' }
        }

        const browserProxy = typeof window !== 'undefined'
        const apiBase = browserProxy ? '/api/backend' : config.url.api
        const response = await fetchWithRetry(`${apiBase}/vm/${encodeURIComponent(id)}/${action}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                id: userId,
            },
            cache: 'no-store',
            timeoutMs: config.abortTimeout,
            retries: 2,
        })

        const data = await readResponse(response)
        if (!response.ok) {
            throw new Error(data?.error || data?.message || `Unable to ${action} ${id}.`)
        }

        return { ok: true, message: data?.message || data?.status || `${action} completed for ${id}.` }
    } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : `Failed to ${action} vm.` }
    }
}

async function readResponse(response: Response): Promise<{ error?: string, message?: string, status?: string }> {
    const text = await response.text()
    if (!text.trim()) {
        return {}
    }

    try {
        const data = JSON.parse(text)
        return data && typeof data === 'object' ? data : { message: String(data) }
    } catch {
        return response.ok ? { message: text } : { error: text }
    }
}
