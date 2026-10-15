import http from 'node:http'

export type LxdRequestOptions = { method?: string, body?: unknown, timeout?: number }

export type LxdResponse<T> = {
    status_code: number
    status: string
    error?: string
    metadata: T
    operation?: string
}

export function requestLxdJson<T>(socketPath: string, path: string, options: LxdRequestOptions = {}) {
    return new Promise<LxdResponse<T>>((resolve, reject) => {
        const body = options.body ? JSON.stringify(options.body) : undefined
        let incoming: http.IncomingMessage | undefined
        const fail = (error: Error) => { clearTimeout(deadline); reject(error) }
        const request = http.request({
            socketPath,
            path,
            method: options.method || 'GET',
            headers: {
                Accept: 'application/json',
                ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {}),
            },
            timeout: options.timeout ?? 125000,
        }, response => {
            incoming = response
            response.on('error', fail)
            response.once('aborted', () => fail(new Error('LXD response interrupted.')))
            let data = ''
            response.setEncoding('utf8')
            response.on('data', chunk => {
                data += chunk
            })
            response.on('end', () => {
                clearTimeout(deadline)
                try {
                    resolve(JSON.parse(data || '{}') as LxdResponse<T>)
                } catch (error) {
                    reject(error)
                }
            })
        })
        // Socket inactivity timeouts alone do not bound partial responses.
        const deadline = setTimeout(() => {
            const error = new Error('LXD request timed out.')
            incoming?.destroy(error)
            request.destroy(error)
            fail(error)
        }, options.timeout ?? 125000)
        request.on('timeout', () => {
            request.destroy(new Error('LXD request timed out.'))
        })
        request.on('error', fail)
        if (body) {
            request.write(body)
        }
        request.end()
    })
}
