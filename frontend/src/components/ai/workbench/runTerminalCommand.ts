import config from '@/config'
import { getCookie } from 'hanasand/cookies'
import randomId from '@/utils/random/randomId'
import { createWorkbenchSocket } from './workbenchSocket'

export function runTerminalCommandOnShare(shares: Share[], shareId: string, command: string, timeoutMs = 20000) {
    const share = shares.find((entry) => entry.id === shareId)
    if (!share?.alias) {
        return Promise.resolve({
            ok: false,
            output: `Share ${shareId} is not available for terminal access yet.`,
        })
    }

    const session = randomId(6)
    const userId = getCookie('id') || 'default'

    return new Promise<{ ok: boolean, output: string }>((resolve) => {
        const ws = createWorkbenchSocket(`${config.url.api_wss}/share/${share.alias}/shell/${userId}/${session}`)
        const chunks: string[] = []
        let settled = false
        let inactivityTimer: number | null = null
        const hardTimeout: number = window.setTimeout(
            () => finish(false, `Timed out after ${timeoutMs}ms.\n\n${chunks.join('')}`),
            timeoutMs
        )

        function clearTimers() {
            clearTimeout(hardTimeout)
            if (inactivityTimer) {
                clearTimeout(inactivityTimer)
            }
        }

        function finish(ok: boolean, output: string) {
            if (settled) {
                return
            }

            settled = true
            clearTimers()
            try {
                ws.close()
            } catch {
                // Socket may already be closed while the promise is settling.
            }
            resolve({ ok, output: output.trim() || '<no output>' })
        }

        function armInactivityTimer() {
            if (inactivityTimer) {
                clearTimeout(inactivityTimer)
            }
            inactivityTimer = window.setTimeout(() => {
                finish(true, chunks.join(''))
            }, 1200)
        }

        ws.onerror = () => finish(false, `Unable to connect to the terminal for share ${share.alias}.`)
        ws.onclose = () => {
            if (!settled) {
                finish(true, chunks.join(''))
            }
        }
        ws.onopen = () => {
            ws.send(JSON.stringify({
                type: 'terminalInput',
                content: `${command}${command.endsWith('\n') ? '' : '\n'}`,
            }))
            armInactivityTimer()
        }
        ws.onmessage = async (event) => {
            try {
                const raw = event.data instanceof Blob ? await event.data.text() : String(event.data)
                const payload = JSON.parse(raw) as { type?: string, content?: string }
                if (payload.type === 'update' && typeof payload.content === 'string') {
                    chunks.push(payload.content)
                    armInactivityTimer()
                }
            } catch {
                // Ignore malformed terminal frames and keep collecting output.
            }
        }
    })
}
