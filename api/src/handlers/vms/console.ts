import { hasVmAccess } from '#utils/vms/access.ts'
import type { FastifyInstance } from 'fastify'
import WebSocket from 'ws'
import run from '#db'
import config from '#constants'
import { validateSession } from '#utils/auth/session.ts'
import { hasHanasandInternalPageAccess } from '#utils/auth/organizationPageAccess.ts'
import { recoveryReadOnly } from '#utils/recovery.ts'
import { startConsoleSession } from '#utils/vms/consoleSession.ts'
import { internalHostWebSocket, supportedHost } from '#utils/vms/hostTransport.ts'
import { deviceProofFromWebSocket } from '#utils/auth/deviceProofRequest.ts'

export async function consoleHost(name: string, id: string, token: string, deviceProof?: { proof?: string, method: string, url: string }, trustedInternal = false): Promise<string | false> {
    const session = await validateSession({ id, token, deviceProof, trustedInternal })
    if (!session) return false
    const result = await run('SELECT primary_host, deleted_at FROM vms WHERE name = $1', [name])
    const vm = result.rows[0]
    const organizationAdmin = await hasHanasandInternalPageAccess(session.user.id)
    if (!vm || vm.deleted_at || (!organizationAdmin && !await hasVmAccess(name, session.user.id, true))) return false
    const host = String(vm.primary_host || config.vm_host_id).toLowerCase()
    return supportedHost(host) ? host : false
}

export async function consoleAccess(name: string, id: string, token: string) { return Boolean(await consoleHost(name, id, token)) }

export default function registerVmConsole(fastify: FastifyInstance) {
    fastify.get<{ Params: { name: string } }>('/api/ws/vm/:name/console', { websocket: true }, (socket, request) => {
        let terminal: ReturnType<typeof startConsoleSession> | undefined
        let upstream: WebSocket | undefined
        let remoteHost: string | undefined
        let authenticated = false
        let starting = false
        let checking = false
        let authenticationDeadline: ReturnType<typeof setTimeout> | undefined
        let connectionDeadline: ReturnType<typeof setTimeout> | undefined
        let credentials: { id: string; token: string } | undefined
        let recheck: ReturnType<typeof setInterval> | undefined
        let heartbeat: ReturnType<typeof setInterval> | undefined
        const send = (value: object) => {
            if (socket.bufferedAmount > 1024 * 1024) { socket.close(1013); close(); return }
            if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(value))
        }
        const close = () => {
            terminal?.close()
            if (upstream?.readyState === WebSocket.CONNECTING) upstream.terminate()
            else upstream?.close()
        }
        const fail = (message: string) => {
            clearTimeout(authenticationDeadline)
            clearTimeout(connectionDeadline)
            send({ type: 'error', message })
            socket.close(1008)
            close()
        }
        const sendToUpstream = (message: object) => {
            if (upstream?.readyState !== WebSocket.OPEN) return fail('The VM host closed the console.')
            if (upstream.bufferedAmount > 1024 * 1024) return fail('The VM host is not accepting console input.')
            upstream.send(JSON.stringify(message))
        }
        authenticationDeadline = setTimeout(() => fail('Unable to read the console session. Reconnect to try again.'), 10000)
        const origin = request.headers.origin
        if (origin && origin !== 'https://hanasand.com' && !(process.env.NODE_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))) {
            clearTimeout(authenticationDeadline)
            socket.close(1008)
            return
        }
        socket.on('close', () => { clearTimeout(authenticationDeadline); clearTimeout(connectionDeadline); clearInterval(recheck); clearInterval(heartbeat); close() })
        socket.on('error', close)
        socket.on('message', async raw => {
            try {
                if (Buffer.byteLength(raw.toString()) > 32768) return fail('Console input is too large.')
                const message = JSON.parse(raw.toString())
                if (!authenticated) {
                    if (starting || message.type !== 'auth' || typeof message.id !== 'string' || typeof message.token !== 'string' || message.id.length > 200 || message.token.length > 512) return fail('Unable to read the console session. Reconnect to try again.')
                    starting = true
                    credentials = { id: message.id, token: message.token }
                    clearTimeout(authenticationDeadline)
                    authenticationDeadline = undefined
                    connectionDeadline = setTimeout(() => fail('Unable to open the console. Check that the VM and its host are running.'), 30000)
                    if (recoveryReadOnly()) return fail('Console access is paused during recovery.')
                    const host = await consoleHost(request.params.name, credentials.id, credentials.token, deviceProofFromWebSocket(request, message.dpop))
                    if (!host) return fail('You do not have access to this VM.')
                    if (socket.readyState !== WebSocket.OPEN) return
                    if (host.toLowerCase() !== String(config.vm_host_id).toLowerCase()) {
                        remoteHost = host
                        upstream = internalHostWebSocket(host, `/vms/internal/${encodeURIComponent(request.params.name)}/console`)
                        upstream.on('message', raw => {
                            try { send(JSON.parse(raw.toString())) } catch { fail('Invalid response from the VM host.') }
                        })
                        upstream.on('error', error => {
                            request.log.warn({ err: error, vmName: request.params.name, host }, 'Remote VM console connection failed')
                            if (authenticated) fail('Unable to open the console. Check that the VM and its host are running.')
                        })
                        upstream.on('close', () => {
                            if (authenticated && socket.readyState === WebSocket.OPEN) fail('The VM host closed the console.')
                        })
                        await new Promise<void>((resolve, reject) => {
                            upstream?.once('open', resolve)
                            upstream?.once('error', reject)
                            upstream?.once('close', () => reject(new Error('VM host closed the console before connecting.')))
                        })
                    } else terminal = startConsoleSession(request.params.name, send)
                    clearTimeout(connectionDeadline)
                    connectionDeadline = undefined
                    authenticated = true
                    request.log.info({ vmName: request.params.name, userId: credentials.id }, 'VM console opened')
                    // Keep idle terminals alive through the public proxy's 15-second timeout.
                    heartbeat = setInterval(() => {
                        if (socket.readyState === WebSocket.OPEN) socket.ping()
                        if (upstream?.readyState === WebSocket.OPEN) upstream.ping()
                    }, 10000)
                    recheck = setInterval(async () => {
                        if (checking || !credentials) return
                        checking = true
                        try {
                            const currentHost = await consoleHost(request.params.name, credentials.id, credentials.token, undefined, true)
                            if (recoveryReadOnly() || !currentHost || currentHost !== (remoteHost || String(config.vm_host_id).toLowerCase())) fail('Your console access has ended. Sign in again or check your VM access.')
                        } catch { fail('Unable to verify console access.') } finally { checking = false }
                    }, 30000)
                    return
                }
                if (message.type === 'input' && typeof message.data === 'string') {
                    if (upstream) sendToUpstream(message)
                    else terminal?.write(message.data)
                } else if (message.type === 'resize' && Number.isInteger(message.cols) && Number.isInteger(message.rows)) {
                    if (upstream) sendToUpstream(message)
                    else terminal?.resize(Math.max(20, Math.min(500, message.cols)), Math.max(8, Math.min(200, message.rows)))
                }
                else fail('Invalid console input.')
            } catch (error) {
                request.log.error({ err: error, vmName: request.params.name }, 'VM console failed')
                fail('Unable to open the console. Check that the VM and its host are running.')
            }
        })
    })
}
