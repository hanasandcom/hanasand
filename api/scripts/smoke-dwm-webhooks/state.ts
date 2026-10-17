import crypto from 'node:crypto'

export const suffix = `${Date.now()}_${crypto.randomUUID().slice(0, 8)}`
export const ownerId = `dwm_webhook_owner_${suffix}`
export const otherUserId = `dwm_webhook_member_${suffix}`
export const orgId = `dwm_webhook_org_${suffix}`
export const endpointSecret = `discord-secret-${suffix}`
export const discordEndpoint = `https://discord.com/api/webhooks/1234567890/${endpointSecret}`

export function expect(condition: unknown, message: string, details?: unknown): asserts condition {
    if (!condition) {
        const error = new Error(message)
        if (details !== undefined) Object.assign(error, { details })
        throw error
    }
}

export const smokeIds = { suffix, ownerId, otherUserId, orgId, endpointSecret, discordEndpoint }
