import { createDeviceProof } from '@/utils/auth/deviceProof'

export async function authenticateConsoleSocket(socket: WebSocket | undefined, url: string, id: string, token: string, workspaceTicket?: string) {
    if (!socket) return
    const { proof } = await createDeviceProof(token, 'GET', url)
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'auth', id, token, dpop: proof, workspaceTicket }))
}

export function vmConsoleSocketUrl(base: string, host?: 'inspur' | 'ovh', name?: string) {
    return base + (host ? '/host/' + encodeURIComponent(host) + '/console' : '/vm/' + encodeURIComponent(name || '') + '/console')
}
