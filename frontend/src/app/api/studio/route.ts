import { NextRequest, NextResponse } from 'next/server'
import config from '@/config'
import requireApiSession from '@/utils/proxy/requireApiSession'
import { isHanasandOrganizationMember } from '@/utils/organizations/hanasandMembership'
import serverDeviceProofHeaders from '@/utils/auth/serverDeviceProofHeaders'
import { validStudio } from '@/utils/studio'

export const dynamic = 'force-dynamic'

async function forward(request: NextRequest, method: 'GET' | 'PUT') {
    if (method === 'PUT') {
        const origin = request.headers.get('origin')
        if (!origin || !URL.canParse(origin) || new URL(origin).host !== request.headers.get('host')) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
    }
    const access = await requireApiSession(request)
    if ('response' in access) return access.response
    const { token, id } = access.identity
    try {
        if (!await isHanasandOrganizationMember(token, id, access.identity)) return NextResponse.json({ error: 'Hanasand organization membership is required.' }, { status: 403 })
    } catch { return NextResponse.json({ error: 'Organization membership could not be checked.' }, { status: 503 }) }
    const document = method === 'PUT' ? await request.json().catch(() => null) : null
    if (method === 'PUT' && !validStudio(document)) return NextResponse.json({ error: 'Invalid Studio document.' }, { status: 400 })
    try {
        const response = await fetch(`${config.url.api}/studio`, {
            method, headers: { ...await serverDeviceProofHeaders(access.identity), Authorization: `Bearer ${token}`, id, ...(method === 'PUT' ? { 'Content-Type': 'application/json' } : {}) },
            ...(method === 'PUT' ? { body: JSON.stringify(document) } : {}),
            cache: 'no-store', signal: AbortSignal.timeout(15000),
        })
        return NextResponse.json(await response.json(), { status: response.status, headers: { 'Cache-Control': 'no-store' } })
    } catch { return NextResponse.json({ error: 'Studio is temporarily unavailable.' }, { status: 503 }) }
}

export const GET = (request: NextRequest) => forward(request, 'GET')
export const PUT = (request: NextRequest) => forward(request, 'PUT')
