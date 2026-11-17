import config from '@/config'
import serverDeviceProofHeaders from '@/utils/auth/serverDeviceProofHeaders'

export type StudioDocument = { title: string, body: string, revision: number }

export function validStudio(value: unknown): value is StudioDocument {
    const document = value as StudioDocument | null
    return typeof document?.title === 'string' && document.title.trim().length > 0
        && document.title.length <= 500 && !/[\r\n]/.test(document.title)
        && typeof document.body === 'string' && document.body.length <= 1_000_000
        && Number.isSafeInteger(document.revision) && document.revision >= 0
}

export async function loadStudio(token: string, id: string): Promise<{ state: 'loaded', document: StudioDocument } | { state: 'invalid-session' | 'not-member' }> {
    const response = await fetch(`${config.url.api}/studio`, {
        headers: { ...await serverDeviceProofHeaders(), Authorization: `Bearer ${token}`, id },
        cache: 'no-store', signal: AbortSignal.timeout(10000),
    })
    if (response.status === 401) return { state: 'invalid-session' }
    if (response.status === 403) return { state: 'not-member' }
    if (!response.ok) throw new Error('Studio could not be loaded.')
    const document = await response.json()
    if (!validStudio(document)) throw new Error('Invalid Studio document.')
    return { state: 'loaded', document }
}
