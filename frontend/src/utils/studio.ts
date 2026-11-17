import config from '@/config'

export type StudioDocument = { id: number, title: string, body: string, revision: number }
export type StudioPage = { id: number, title: string }

export function validStudio(value: unknown): value is StudioDocument {
    const document = value as StudioDocument | null
    return document !== null && Number.isSafeInteger(document.id) && document.id > 0 && document.id <= 32767
        && typeof document.title === 'string' && document.title.trim().length > 0
        && document.title.length <= 500 && !/[\r\n]/.test(document.title)
        && typeof document.body === 'string' && document.body.length <= 1_000_000
        && Number.isSafeInteger(document.revision) && document.revision >= 0
}

export async function loadStudio(page = 1): Promise<StudioDocument | null> {
    const response = await fetch(`${config.url.api}/studio?page=${page}`, {
        cache: 'no-store', signal: AbortSignal.timeout(10000),
    })
    if (response.status === 404) return null
    if (!response.ok) throw new Error('Studio could not be loaded.')
    const document = await response.json()
    if (!validStudio(document)) throw new Error('Invalid Studio document.')
    return document
}
