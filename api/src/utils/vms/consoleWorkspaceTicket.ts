import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import config from '#constants'

export type VmConsoleWorkspaceTicket = {
    v: 1
    vm: string
    userId: string
    organizationId: string | null
    sessionHash: string
    nonce: string
    expiresAt: number
}

const consumedTickets = new Map<string, number>()

export function verifyVmConsoleWorkspaceTicket(ticket: unknown, input: { vm: string; userId: string; sessionToken: string }): VmConsoleWorkspaceTicket | null {
    const parts = typeof ticket === 'string' ? ticket.split('.') : []
    if (parts.length !== 2 || !config.vm_api_token) return null
    let actualSignature: Buffer
    let payload: VmConsoleWorkspaceTicket
    try {
        actualSignature = Buffer.from(parts[1], 'base64url')
        const expectedSignature = createHmac('sha256', config.vm_api_token).update(parts[0]).digest()
        if (actualSignature.length !== expectedSignature.length || !timingSafeEqual(actualSignature, expectedSignature)) return null
        payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')) as VmConsoleWorkspaceTicket
    } catch { return null }

    if (!payload || payload.v !== 1 || typeof payload.vm !== 'string' || payload.vm !== input.vm.toLowerCase()
        || payload.userId !== input.userId || typeof payload.nonce !== 'string' || !payload.nonce
        || !Number.isSafeInteger(payload.expiresAt) || payload.expiresAt <= Math.floor(Date.now() / 1000)
        || (payload.organizationId !== null && typeof payload.organizationId !== 'string')
        || payload.sessionHash !== createHash('sha256').update(input.sessionToken).digest('hex')) return null
    return payload
}

export function consumeVmConsoleWorkspaceTicket(ticket: VmConsoleWorkspaceTicket) {
    const now = Math.floor(Date.now() / 1000)
    for (const [nonce, expiresAt] of consumedTickets) if (expiresAt <= now) consumedTickets.delete(nonce)
    if (consumedTickets.has(ticket.nonce)) return false
    if (consumedTickets.size >= 10000) consumedTickets.delete(consumedTickets.keys().next().value!)
    consumedTickets.set(ticket.nonce, ticket.expiresAt)
    return true
}
