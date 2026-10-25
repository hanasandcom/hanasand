import { authenticateConsoleSocket, vmConsoleSocketUrl } from '@/utils/vms/authenticateConsoleSocket'

export async function openWorkspaceConsoleSocket(apiWss: string, host: 'inspur' | 'ovh' | undefined, name: string | undefined, id: string, token: string, signal: AbortSignal, onOpen: () => void) {
    let ticket = ''
    if (!host) {
        const response = await fetch(`/api/vm-console-ticket/${encodeURIComponent(name || '')}`, { cache: 'no-store', signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]) })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok || typeof payload.ticket !== 'string') throw new Error(response.status === 404 ? 'VM not found in this workspace.' : 'VM console authorization is unavailable.')
        ticket = payload.ticket
    }
    const url = vmConsoleSocketUrl(apiWss, host, name)
    const socket = new WebSocket(url)
    socket.onopen = () => {
        void authenticateConsoleSocket(socket, url, id, token, ticket).catch(() => socket.close())
        onOpen()
    }
    return socket
}

export function refreshWorkspaceConsoleTicket(socket: WebSocket, name: string, onFailure: () => void) {
    return setInterval(() => {
        void fetch(`/api/vm-console-ticket/${encodeURIComponent(name)}`, { cache: 'no-store', signal: AbortSignal.timeout(10000) })
            .then(async response => {
                const payload = await response.json().catch(() => ({}))
                if (!response.ok || typeof payload.ticket !== 'string') throw new Error('Workspace changed')
                if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'workspace-auth', ticket: payload.ticket }))
            })
            .catch(onFailure)
    }, 15000)
}
