import crypto from 'node:crypto'

const IV_LENGTH = 12
const keySourceEnvNames = ['AI_REPO_SECRET_KEY', 'VM_API_TOKEN', 'MAIL_SERVICE_KEY', 'DB_PASSWORD'] as const
const previousKeySourceEnvNames = [
    'AI_REPO_SECRET_KEY_PREVIOUS',
    'VM_API_TOKEN_PREVIOUS',
    'MAIL_SERVICE_KEY_PREVIOUS',
    'DB_PASSWORD_PREVIOUS',
] as const

export function encryptRepoSecret(value: string) {
    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(repoCredentialKeySource()), iv)
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag()
    return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`
}

export function decryptRepoSecret(value: string) {
    const [ivB64, tagB64, dataB64] = value.split('.')
    if (!ivB64 || !tagB64 || !dataB64) {
        return value
    }

    for (const source of repoCredentialKeySources()) {
        try {
            return decryptWithSource(value, source)
        } catch {
            // Keep old ciphertext readable while a key rotation is in progress.
        }
    }

    throw new Error('Unable to decrypt repository credential with the configured keys.')
}

export function isRepoSecretEncryptedWithCurrentKey(value: string) {
    if (!value.includes('.')) return false

    try {
        decryptWithSource(value, repoCredentialKeySource())
        return true
    } catch {
        return false
    }
}

function deriveKey(source: string) {
    return crypto.createHash('sha256').update(source).digest()
}

function decryptWithSource(value: string, source: string) {
    const [ivB64, tagB64, dataB64] = value.split('.')
    if (!ivB64 || !tagB64 || !dataB64) return value

    const decipher = crypto.createDecipheriv('aes-256-gcm', deriveKey(source), Buffer.from(ivB64, 'base64'))
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
    return Buffer.concat([
        decipher.update(Buffer.from(dataB64, 'base64')),
        decipher.final(),
    ]).toString('utf8')
}

function repoCredentialKeySource() {
    for (const name of keySourceEnvNames) {
        const value = process.env[name]?.trim()
        if (value) return value
    }

    throw new Error('AI_REPO_SECRET_KEY or another server-side secret source is required for repository credentials.')
}

function repoCredentialKeySources() {
    const values = [...keySourceEnvNames, ...previousKeySourceEnvNames]
        .map(name => process.env[name]?.trim())
        .filter((value): value is string => Boolean(value))

    return [...new Set(values)]
}
