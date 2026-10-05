import { NextResponse } from 'next/server'
import { getDatabaseQueries } from '@/utils/db/internal'

export const dynamic = 'force-dynamic'

export async function GET() {
    const overview = await getDatabaseQueries()
    if (typeof overview === 'string') {
        return NextResponse.json({ message: overview.replace(/^Error:\s*/i, 'Database queries are temporarily unavailable.') }, {
            status: 503,
            headers: { 'Cache-Control': 'no-store' },
        })
    }

    return NextResponse.json({ queries: overview.queries, longestQuery: overview.longestQuery }, {
        headers: { 'Cache-Control': 'no-store' },
    })
}
