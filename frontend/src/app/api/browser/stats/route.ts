import config from '@/config'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const cacheControl = 'public, max-age=10, s-maxage=30, stale-while-revalidate=60'

export async function GET() {
    try {
        const apiUrl = `${config.url.api.replace(/\/$/, '')}/browser/stats`
        const response = await fetch(apiUrl, {
            next: { revalidate: 30 },
            signal: AbortSignal.timeout(5_000),
        })
        if (!response.ok) {
            return NextResponse.json({ error: 'Browser stats are temporarily unavailable.' }, {
                status: 502,
                headers: { 'cache-control': 'no-store' },
            })
        }

        return NextResponse.json(await response.json(), { headers: { 'cache-control': cacheControl } })
    } catch {
        return NextResponse.json({ error: 'Browser stats are temporarily unavailable.' }, {
            status: 502,
            headers: { 'cache-control': 'no-store' },
        })
    }
}
