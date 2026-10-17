import { createHash, randomBytes } from 'crypto'

export function buildApiKeySecret() {
    const prefix = randomBytes(6).toString('hex')
    const suffix = randomBytes(24).toString('hex')
    return `hsk_${prefix}_${suffix}`
}

export function extractApiKeyPrefix(secret: string) {
    if (!secret.startsWith('hsk_')) return ''
    const parts = secret.split('_')
    return parts[1] || ''
}

export function hashApiKeySecret(secret: string) {
    return createHash('sha256').update(secret).digest('hex')
}
