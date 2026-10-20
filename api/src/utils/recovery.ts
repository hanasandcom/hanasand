import { readFileSync } from 'node:fs'

type RecoveryState = { readOnly?: boolean; mode?: string; reason?: string; updatedAt?: string; site?: string;
    services?: { id?: string; activeSite?: string; status?: string }[] }
let cached: RecoveryState = {}
let checkedAt = 0
export function recoveryState(): RecoveryState {
    const path = process.env.RECOVERY_STATE_FILE
    if (!path) return {}
    if (Date.now() - checkedAt < 1000) return cached
    checkedAt = Date.now()
    try {
        cached = JSON.parse(readFileSync(path, 'utf8')) as RecoveryState
        if (typeof cached.readOnly !== 'boolean' || !cached.updatedAt || Date.now() - Date.parse(cached.updatedAt) > 60_000 || !Number.isFinite(Date.parse(cached.updatedAt))) throw new Error('Stale recovery status')
    } catch {
        cached = { readOnly: true, mode: 'unknown', reason: 'Recovery status is unavailable; changes are paused for safety.' }
    }
    return cached
}
export function recoveryReadOnly() { return recoveryState().readOnly === true }
export function recoveryRequestAllowed(method: string, path: string) {
    const publicRead = ['GET', 'HEAD'].includes(method) && ['/api/system/updates', '/api/status'].includes(path)
    const readOnlySearch = method === 'POST' && path === '/api/ti/search'
    if (process.env.RECOVERY_ESSENTIAL_ONLY === '1' && !publicRead && !/^\/(health$|ready$|api\/(health$|auth\/|user(?:\/|$)|organizations(?:\/|$)))/.test(path)) return false
    if (!recoveryReadOnly()) return true
    return (['GET', 'HEAD', 'OPTIONS'].includes(method) || readOnlySearch) && !/\/auth\/logout\/|\/restart\//.test(path)
}
