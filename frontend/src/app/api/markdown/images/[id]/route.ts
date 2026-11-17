import { NextRequest, NextResponse } from 'next/server'
import config from '@/config'
import requireApiSession from '@/utils/proxy/requireApiSession'
import { isHanasandOrganizationMember } from '@/utils/organizations/hanasandMembership'
import serverDeviceProofHeaders from '@/utils/auth/serverDeviceProofHeaders'

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const imageId = (await context.params).id
        if (!/^[a-f0-9-]{36}$/i.test(imageId)) return new NextResponse(null, { status: 404 })
        const url = `${config.url.api}/markdown/images/${imageId}`
        let response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(10000) })
        if (response.status === 401) {
            const access = await requireApiSession(request)
            if ('response' in access) return access.response
            const { token, id } = access.identity
            if (!await isHanasandOrganizationMember(token, id, access.identity)) return NextResponse.json({ error: 'Hanasand organization membership is required.' }, { status: 403 })
            response = await fetch(url, { headers: { ...await serverDeviceProofHeaders(access.identity), Authorization: `Bearer ${token}`, id }, cache: 'no-store', signal: AbortSignal.timeout(10000) })
        }
        if (!response.ok) return new NextResponse(null, { status: response.status })
        return new NextResponse(response.body, { headers: { 'Content-Type': response.headers.get('content-type') || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } })
    } catch { return new NextResponse(null, { status: 503 }) }
}
