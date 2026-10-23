import { historyApiPath } from './browserSetup'

export async function deleteBrowserHistory(clientId: string, ids: string[] | undefined, fallback: string) {
    const response = await fetch(historyApiPath, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, ...(ids ? { ids } : { clear: true }) }),
    })
    const payload = await response.json() as { error?: string }
    if (!response.ok) throw new Error(payload.error || fallback)
}
