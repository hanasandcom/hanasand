import { NextRequest } from 'next/server'
import { proxyOrganizationApiRequest } from '@/app/api/organizations/_organizationApiProxy'
import { proxyOrganizationAlertReadiness } from '../../organizationAlertReadinessProxy'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params
    return proxyOrganizationAlertReadiness(request, id, proxyOrganizationApiRequest)
}
