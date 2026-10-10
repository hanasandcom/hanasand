import 'server-only'
import type { ProfileSshKey } from '@/utils/sshKeys'

const IDENTITY_REQUEST_TIMEOUT_MS = 3000

export async function getProfileSshKeysFromIdentity(id: string, token: string): Promise<ProfileSshKey[] | null> {
    const identityApi = (process.env.FRONTEND_IDENTITY_API || 'http://identity:8081/api').replace(/\/+$/, '')
    try {
        const response = await fetch(`${identityApi}/user/self/ssh-keys`, {
            cache: 'no-store',
            headers: { Authorization: `Bearer ${decodeToken(token)}`, id },
            signal: AbortSignal.timeout(IDENTITY_REQUEST_TIMEOUT_MS),
        })
        if (!response.ok) return null
        const data = await response.json() as { keys?: unknown }
        return Array.isArray(data.keys) ? data.keys as ProfileSshKey[] : null
    } catch {
        return null
    }
}

function decodeToken(token: string) {
    try {
        return decodeURIComponent(token)
    } catch {
        return token
    }
}
