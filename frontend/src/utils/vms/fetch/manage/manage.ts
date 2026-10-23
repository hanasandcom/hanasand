import config from '@/config'
import fetchWithRetry from '@/utils/fetchWithRetry'
import { getCookie } from 'hanasand/cookies'

export type VMActionResult = { ok: true, message: string } | { ok: false, message: string }

export default async function manageVM(id: string, action: 'start' | 'stop' | 'restart'): Promise<VMActionResult> {
    try {
        if (!id.trim()) {
            return { ok: false, message: 'This virtual machine is missing its instance name.' }
        }

        const browserProxy = typeof window !== 'undefined'
        const token = browserProxy ? null : getCookie('access_token')
        const userId = browserProxy ? null : getCookie('id')
        if (!browserProxy && (!token || !userId)) {
            return { ok: false, message: 'Please log in to manage VMs.' }
        }

        const apiBase = browserProxy ? '/api/backend' : config.url.api
        const response = await fetchWithRetry(`${apiBase}/vm/${encodeURIComponent(id)}/${action}`, {
            method: 'POST',
            ...(browserProxy ? { credentials: 'same-origin' as const } : {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    id: userId!,
                },
            }),
            cache: 'no-store',
            // The API waits for the host command (which can take up to two minutes).
            // Replaying a timed-out POST could execute the VM action twice.
            timeoutMs: 180000,
            retries: 0,
        })

        const data = await readResponse(response)
        if (!response.ok) {
            const message = data?.error || data?.message || `Unable to ${action} ${id}.`
            if (isTimeoutMessage(message)) return { ok: false, message: timeoutMessage(action) }
            throw new Error(message)
        }

        return { ok: true, message: data?.message || data?.status || `${action} completed for ${id}.` }
    } catch (error) {
        if (isAbort(error)) {
            return { ok: false, message: timeoutMessage(action) }
        }
        return { ok: false, message: error instanceof Error ? error.message : `Unable to ${action} the VM. Please try again.` }
    }
}

function isAbort(error: unknown) {
    return error instanceof Error && (error.name === 'AbortError' || isTimeoutMessage(error.message))
}

function isTimeoutMessage(message: string) {
    return /aborted|timed out|timeout|did not respond in time/i.test(message)
}

function timeoutMessage(action: string) {
    return `The ${action} request timed out. The VM may still be processing it; check its status before trying again.`
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
