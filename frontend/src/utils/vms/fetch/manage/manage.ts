import config from '@/config'
import fetchWithRetry from '@/utils/fetchWithRetry'

export default async function manageVM(id: string, action: 'start' | 'stop' | 'restart'): Promise<string | null> {
    try {
        if (!id.trim()) {
            return 'This virtual machine is missing its instance name.'
        }

        const response = await fetchWithRetry(`/api/backend/vm/${encodeURIComponent(id)}/${action}`, {
            method: 'POST',
            cache: 'no-store',
            timeoutMs: config.abortTimeout,
            retries: 2,
        })

        const data = await readResponse(response)
        if (!response.ok) {
            throw new Error(data?.error || data?.message || `Unable to ${action} ${id}.`)
        }

        return data?.message || data?.status || `${action} completed for ${id}.`
    } catch (error) {
        return error instanceof Error ? error.message : `Failed to ${action} vm.`
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
