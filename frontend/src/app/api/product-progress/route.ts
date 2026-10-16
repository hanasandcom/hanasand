import { activeOrganizationId } from '@/utils/organizations/serverWorkspace'
import { NextRequest, NextResponse } from 'next/server'
import { getProductProgressPayload } from './response'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    const payload = await getProductProgressPayload(request, { activeOrganizationId })
    return NextResponse.json(payload, { headers: { 'cache-control': 'no-store' } })
}
