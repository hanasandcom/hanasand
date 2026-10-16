import { decryptSecret, deriveSecretKey, encryptSecret } from '#utils/crypto/secretBox.ts'

const currentSecretKey = process.env.DWM_WEBHOOK_SECRET_KEY
    || process.env.MAIL_SERVICE_KEY
    || process.env.VM_API_TOKEN
    || process.env.DB_PASSWORD
    || 'hanasand-dwm-webhooks-development-key'

const secretKeys = [
    currentSecretKey,
    process.env.DWM_WEBHOOK_SECRET_KEY_PREVIOUS,
    process.env.MAIL_SERVICE_KEY,
    process.env.MAIL_SERVICE_KEY_PREVIOUS,
    process.env.VM_API_TOKEN,
    process.env.VM_API_TOKEN_PREVIOUS,
    process.env.DB_PASSWORD,
    process.env.DB_PASSWORD_PREVIOUS,
].filter((value, index, values): value is string => typeof value === 'string' && values.indexOf(value) === index)
    .map(deriveSecretKey)

export function encryptWebhookSecret(value: string) {
    return encryptSecret(value, secretKeys[0])
}

export function encryptWebhookTarget(endpoint: string, signingSecret: string) {
    return encryptWebhookSecret(JSON.stringify({ endpoint, signingSecret }))
}

export function decryptWebhookSecret(value: string) {
    return decryptSecret(value, secretKeys)
}

export function decryptWebhookTarget(value: string) {
    const decrypted = decryptWebhookSecret(value)
    try {
        const target = JSON.parse(decrypted) as { endpoint?: unknown, signingSecret?: unknown }
        if (typeof target.endpoint === 'string' && typeof target.signingSecret === 'string') {
            return { endpoint: target.endpoint, signingSecret: target.signingSecret }
        }
    } catch {
        // Legacy destinations stored only the encrypted endpoint.
    }
    return { endpoint: decrypted, signingSecret: '' }
}
