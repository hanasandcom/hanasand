import { NextRequest } from 'next/server'
import { proxyOrganizationWatchlistRead } from '@/app/api/organizations/organizationWatchlistSession'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params
    return proxyOrganizationWatchlistRead(request, `/organizations/${encodeURIComponent(id)}/watchlists/alert-terms`, id)
}
