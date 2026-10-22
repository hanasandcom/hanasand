import { NextRequest, NextResponse } from 'next/server'
import { isHanasandOrganizationMember } from '@/utils/organizations/hanasandMembership'
import requireApiSession from '@/utils/proxy/requireApiSession'

export default async function requirePromptPortalSession(request: NextRequest) {
    const access = await requireApiSession(request)
    if ('response' in access) return access
    try {
        if (await isHanasandOrganizationMember(access.identity.token, access.identity.id, access.identity)) return access
    } catch {
        return failure(503, 'organization_check_unavailable', 'Hanasand organization membership could not be checked.')
    }
    return failure(403, 'organization_access_required', 'Active Hanasand organization membership is required.')
}

function failure(status: number, code: string, message: string) {
    const response = NextResponse.json({ ok: false, error: { code, message } }, { status, headers: { 'cache-control': 'no-store' } })
    return { response }
}
