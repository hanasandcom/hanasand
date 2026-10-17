import { randomBytes } from 'crypto'

export type PasskeyConfig = {
    rpId: string
    rpName: string
    origin: string
}

export function passkeyConfig(): PasskeyConfig {
    const origin = clean(process.env.PASSKEY_ORIGIN)
        || clean(process.env.WEBAUTHN_ORIGIN)
        || clean(process.env.NEXT_PUBLIC_APP_URL)
        || 'https://hanasand.com'
    const rpId = clean(process.env.PASSKEY_RP_ID)
        || clean(process.env.WEBAUTHN_RP_ID)
        || hostnameFromOrigin(origin)
        || 'hanasand.com'
    return {
        origin,
        rpId,
        rpName: clean(process.env.PASSKEY_RP_NAME) || 'Hanasand',
    }
}

export function newPasskeyChallenge() {
    return randomBytes(32).toString('base64url')
}

export function userHandleFor(userId: string) {
    return Buffer.from(userId, 'utf8').toString('base64url')
}

export function decodeUserHandle(value: string | null | undefined) {
    if (!value) return null
    try {
        return Buffer.from(value, 'base64url').toString('utf8')
    } catch {
        return null
    }
}

export function publicKeyCredentialDescriptor(id: string) {
    return {
        type: 'public-key',
        id,
        transports: ['internal', 'hybrid', 'usb', 'nfc', 'ble'],
    }
}

function hostnameFromOrigin(origin: string) {
    try {
        return new URL(origin).hostname
    } catch {
        return ''
    }
}

function clean(value: unknown) {
    return String(value ?? '').trim()
}
