import { getCookie } from 'hanasand/cookies'
import { prepareVmConsole } from '@/utils/vms/prepareConsole'

export async function prepareVmConsoleSession(name: string | undefined, host: 'inspur' | 'ovh' | undefined, signal: AbortSignal, onStatus: (status: string) => void, onFailure: (error: unknown) => void) {
    if (host || (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('provisioning') === '1')) return true
    try {
        if (!name) throw new Error('Select a virtual machine to open its console.')
        await prepareVmConsole(name, '/api/backend', getCookie('id') || '', decodeURIComponent(getCookie('access_token') || ''), onStatus, AbortSignal.any([signal, AbortSignal.timeout(120000)]))
        return true
    } catch (error) {
        onFailure(error)
        return false
    }
}
