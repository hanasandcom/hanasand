import type { FastifyInstance } from 'fastify'
import WebSocket from 'ws'
import config from '#constants'
import run from '#db'
import hasInternalToken from '#utils/auth/internalToken.ts'
import { recoveryReadOnly } from '#utils/recovery.ts'
import { canUseLocalLxd } from '#utils/vms/lxd.ts'
import { supportedHost } from '#utils/vms/hostTransport.ts'
import { startConsoleSession } from '#utils/vms/consoleSession.ts'

export default function registerInternalVmConsole(fastify: FastifyInstance) {
    fastify.get<{ Params: { name: string } }>('/api/vms/internal/:name/console', { websocket: true }, (socket, request) => {
        let terminal: ReturnType<typeof startConsoleSession> | undefined
        const name = request.params.name
        if (!hasInternalToken(request) || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,62}$/.test(name)) { socket.close(1008); return }
        const deadline = setTimeout(() => close(1013), 10000)
        const close = (code = 1008) => {
            clearTimeout(deadline)
            terminal?.close()
            if (socket.readyState === WebSocket.OPEN) socket.close(code)
        }
        socket.on('close', () => { clearTimeout(deadline); terminal?.close() })
        socket.on('error', () => { clearTimeout(deadline); terminal?.close() })
        socket.on('message', raw => {
            try {
                if (!terminal || Buffer.byteLength(raw.toString()) > 32768) return close()
                const message = JSON.parse(raw.toString())
                if (message.type === 'input' && typeof message.data === 'string') terminal.write(message.data)
                else if (message.type === 'resize' && Number.isInteger(message.cols) && Number.isInteger(message.rows)) terminal.resize(Math.max(20, Math.min(500, message.cols)), Math.max(8, Math.min(200, message.rows)))
                else close()
            } catch { close() }
        })
        void authorizeLocalVm(name).then(allowed => {
            if (!allowed || socket.readyState !== WebSocket.OPEN) return close()
            clearTimeout(deadline)
            terminal = startConsoleSession(name, value => {
                if (socket.bufferedAmount > 1024 * 1024) return close(1013)
                if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(value))
            })
        }).catch(error => {
            request.log.warn({ err: error, vmName: name }, 'Internal VM console authorization failed')
            close(1011)
        })
    })
}

async function authorizeLocalVm(name: string) {
    const host = config.vm_host_id
    if (!supportedHost(host) || recoveryReadOnly()) return false
    const result = await run(`
        SELECT primary_host
        FROM vms
        WHERE LOWER(name) = LOWER($1)
          AND deleted_at IS NULL
        LIMIT 1
    `, [name])
    const vm = result.rows[0] as { primary_host: string | null } | undefined
    if (!vm || vm.primary_host?.toLowerCase() !== host.toLowerCase()) return false
    return canUseLocalLxd()
}
