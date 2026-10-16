type OrganizationProxy<Request, Response> = (
    request: Request,
    path: string,
    options: { method: 'GET' },
) => Promise<Response>

export function proxyOrganizationAlertReadiness<Request, Response>(
    request: Request,
    id: string,
    proxy: OrganizationProxy<Request, Response>,
) {
    const path = `/organizations/${encodeURIComponent(id)}/alert-readiness`
    return proxy(request, path, { method: 'GET' })
}
