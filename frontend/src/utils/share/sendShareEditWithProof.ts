import { getCookie } from 'hanasand/cookies'
import { createDeviceProof } from '@/utils/auth/deviceProof'

export async function sendShareEditWithProof(socket: WebSocket, id: string, content: string, url: string) {
    const userId = getCookie('id') || ''
    const token = getCookie('access_token') || ''
    const proof = token ? await createDeviceProof(token, 'GET', url) : null
    if (socket.readyState !== WebSocket.OPEN) return false
    socket.send(JSON.stringify({ type: 'edit', userId, token, id, content, ...(proof ? { dpop: proof.proof } : {}) }))
    return true
}
