import { NextRequest } from 'next/server'
import { proxyOrganizationWatchlistRead } from '@/app/api/organizations/organizationWatchlistSession'
import { proxyOrganizationWatchlistMutation } from '@/app/api/organizations/_organizationWatchlistDwmBridge'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params
    return proxyOrganizationWatchlistRead(request, `/organizations/${encodeURIComponent(id)}/watchlists`, id)
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params
    return proxyOrganizationWatchlistMutation(request, `/organizations/${encodeURIComponent(id)}/watchlists`, { method: 'POST', organizationId: id })
}
