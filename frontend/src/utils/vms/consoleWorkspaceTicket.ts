import 'server-only'
import { createHash, createHmac, randomUUID } from 'node:crypto'

export type VmConsoleWorkspaceTicket = {
    v: 1
    vm: string
    userId: string
    organizationId: string | null
    sessionHash: string
    nonce: string
    expiresAt: number
}

const ticketLifetimeSeconds = 45

export function issueVmConsoleWorkspaceTicket(input: { vm: string; userId: string; token: string; organizationId?: string }) {
    const secret = process.env.VM_API_TOKEN
    if (!secret || !input.vm || !input.userId || !input.token) throw new Error('VM console workspace signing is unavailable.')
    const payload: VmConsoleWorkspaceTicket = {
        v: 1,
        vm: input.vm.toLowerCase(),
        userId: input.userId,
        organizationId: input.organizationId || null,
        sessionHash: createHash('sha256').update(input.token).digest('hex'),
        nonce: randomUUID(),
        expiresAt: Math.floor(Date.now() / 1000) + ticketLifetimeSeconds,
    }
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
    const signature = createHmac('sha256', secret).update(encoded).digest('base64url')
    return `${encoded}.${signature}`
}
