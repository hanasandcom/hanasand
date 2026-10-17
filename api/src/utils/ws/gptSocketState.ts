import { WebSocket as WS } from 'ws'

export const gpt = new Map<string, Set<WS>>()
export const gptSockets = new Map<WS, GPT_SocketState>()

export function countGptViewers(id: string, clients: Map<string, Set<WS>> = gpt) {
    return [...(clients.get(id) || [])].filter((socket) => gptSockets.get(socket)?.role !== 'producer').length
}
