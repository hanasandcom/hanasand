import { apiBaseUrl, baseUrl, serviceKey, timeoutMs } from './monitor-config.mjs'
import { MonitorFailure } from './monitor-errors.mjs'

export async function authenticateServiceAccount(context, onAuthenticated, fetcher = fetch) {
    const response = await fetcher(`${apiBaseUrl}/service-accounts/self`, {
        headers: { 'X-API-Key': serviceKey }, signal: AbortSignal.timeout(timeoutMs),
    })
    if (!response.ok) throw new MonitorFailure('service_account_auth_failed', `Service account authentication returned ${response.status}.`, {})
    const identity = await response.json()
    if (typeof identity.id !== 'string' || !identity.pages?.includes('/db')) {
        throw new MonitorFailure('service_account_scope_missing', 'The service account needs GET /api/service-accounts/self and GET /api/db.', {})
    }
    onAuthenticated(identity.id)
    await context.addCookies([
        { name: 'id', value: identity.id, url: baseUrl, httpOnly: true, secure: true, sameSite: 'Strict' },
        { name: 'access_token', value: serviceKey, url: baseUrl, httpOnly: true, secure: true, sameSite: 'Strict' },
    ])
}
