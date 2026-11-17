import { NextRequest, NextResponse } from 'next/server'
import config from '@/config'
import requireApiSession from '@/utils/proxy/requireApiSession'
import { isHanasandOrganizationMember } from '@/utils/organizations/hanasandMembership'
import serverDeviceProofHeaders from '@/utils/auth/serverDeviceProofHeaders'

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        const response = await fetch(`${config.url.api}/studio/pages`, { cache: 'no-store', signal: AbortSignal.timeout(10000) })
        return NextResponse.json(await response.json(), { status: response.status, headers: { 'Cache-Control': 'no-store' } })
    } catch { return NextResponse.json({ error: 'Studio pages are temporarily unavailable.' }, { status: 503 }) }
}

export async function POST(request: NextRequest) {
    const origin = request.headers.get('origin')
    if (!origin || !URL.canParse(origin) || new URL(origin).host !== request.headers.get('host')) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
    const access = await requireApiSession(request)
    if ('response' in access) return access.response
    const { token, id } = access.identity
    try {
        if (!await isHanasandOrganizationMember(token, id, access.identity)) return NextResponse.json({ error: 'Hanasand organization membership is required.' }, { status: 403 })
        const response = await fetch(`${config.url.api}/studio/pages`, {
            method: 'POST', headers: { ...await serverDeviceProofHeaders(access.identity), Authorization: `Bearer ${token}`, id },
            cache: 'no-store', signal: AbortSignal.timeout(15000),
        })
        return NextResponse.json(await response.json(), { status: response.status, headers: { 'Cache-Control': 'no-store' } })
    } catch { return NextResponse.json({ error: 'Studio page could not be created.' }, { status: 503 }) }
}
