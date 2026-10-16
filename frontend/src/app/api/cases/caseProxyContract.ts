type CaseProxyMethod = 'GET' | 'POST'
type CaseProxyAction = 'customer-notification' | 'export'

export type CaseProxy<Request, Response> = (
    request: Request,
    path: string,
    options: { method: CaseProxyMethod },
) => Promise<Response>

export function proxyCaseAction<Request, Response>(
    request: Request,
    id: string,
    action: CaseProxyAction,
    proxy: CaseProxy<Request, Response>,
) {
    const method = action === 'customer-notification' ? 'POST' : 'GET'
    const path = `/v1/cases/${encodeURIComponent(id)}/${action}`
    return proxy(request, path, { method })
}
