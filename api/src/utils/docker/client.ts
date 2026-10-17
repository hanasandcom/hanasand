import http from 'node:http'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'

const DEFAULT_SOCKET_PATH = resolveDockerSocketPath()

export function canUseDockerSocket() {
    return existsSync(DEFAULT_SOCKET_PATH)
}

function resolveDockerSocketPath() {
    const explicitPath = process.env.DOCKER_SOCKET_PATH
    if (explicitPath) return explicitPath

    const dockerHost = process.env.DOCKER_HOST
    if (dockerHost?.startsWith('unix://')) {
        return dockerHost.slice('unix://'.length)
    }

    const candidates = [
        '/var/run/docker.sock',
        `${homedir()}/.docker/run/docker.sock`,
    ]
    return candidates.find((candidate) => existsSync(candidate)) || candidates[0]
}

export function requestDocker(path: string, options: { method?: string; body?: unknown; timeoutMs?: number } = {}) {
    return new Promise<Buffer>((resolve, reject) => {
        if (!canUseDockerSocket()) {
            reject(new Error(`Docker socket is unavailable at ${DEFAULT_SOCKET_PATH}`))
            return
        }

        let response: http.IncomingMessage | undefined
        const fail = (error: Error) => { clearTimeout(timeout); reject(error) }
        const body = options.body === undefined ? null : Buffer.from(JSON.stringify(options.body))
        const req = http.request(
            {
                socketPath: DEFAULT_SOCKET_PATH,
                path,
                method: options.method || 'GET',
                headers: body ? {
                    'Content-Type': 'application/json',
                    'Content-Length': String(body.length),
                } : undefined,
            },
            (res) => {
                response = res
                const chunks: Buffer[] = []
                res.on('error', fail)
                res.once('aborted', () => fail(new Error(`Docker response interrupted for ${path}`)))

                res.on('data', (chunk) => {
                    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
                })

                res.on('end', () => {
                    clearTimeout(timeout)
                    const body = Buffer.concat(chunks)
                    if ((res.statusCode || 500) >= 400) {
                        reject(new Error(body.toString('utf8') || `Docker API responded with ${res.statusCode}`))
                        return
                    }

                    resolve(body)
                })
            }
        )

        // Socket timeouts reset on each chunk; bound the whole collection too.
        const timeout = setTimeout(() => {
            const error = Object.assign(new Error(`Docker API timed out for ${path}`), { code: 'ETIMEDOUT' })
            response?.destroy(error)
            req.destroy(error)
            fail(error)
        }, options.timeoutMs || 4_000)
        req.on('error', fail)
        if (body) req.write(body)
        req.end()
    })
}
