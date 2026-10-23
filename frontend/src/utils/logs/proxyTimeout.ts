// The cold Errors summary has a bounded 30-second database query. Allow its
// response to arrive without extending other workspace reads or caller aborts.
export function logsProxyTimeoutMs(method: string, path: string[], defaultTimeout: number) {
    return method === 'GET' && path.length === 2 && path[0] === 'logs' && path[1] === 'errors'
        ? Math.max(defaultTimeout, 45_000) : null
}
