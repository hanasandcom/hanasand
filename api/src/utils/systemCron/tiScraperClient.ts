export type TiFetchResult = {
    ok: boolean
    status: number
    json: unknown
    error: string | null
}

export async function fetchTiJson(path: string): Promise<TiFetchResult> {
    const base = tiBase()
    if (!base) return { ok: false, status: 0, json: {}, error: 'TI_SCRAPER_API_BASE is not configured.' }
    try {
        const response = await fetch(new URL(path, base), {
            cache: 'no-store',
            headers: process.env.TI_SCRAPER_SERVICE_TOKEN
                ? { 'x-hanasand-service-token': process.env.TI_SCRAPER_SERVICE_TOKEN }
                : undefined,
            signal: AbortSignal.timeout(6000),
        })
        const text = await response.text()
        let json: unknown = {}
        try {
            json = text ? JSON.parse(text) : {}
        } catch {
            json = { body: text }
        }
        return { ok: response.ok, status: response.status, json, error: response.ok ? null : `TI scraper returned ${response.status}` }
    } catch (error) {
        return { ok: false, status: 0, json: {}, error: error instanceof Error ? error.message : String(error) }
    }
}

export function tiBase() {
    return process.env.TI_SCRAPER_API_BASE?.replace(/\/$/, '') || ''
}
