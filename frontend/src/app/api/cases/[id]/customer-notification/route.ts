import { NextRequest } from 'next/server'
import { proxyTiRequest } from '../../../findings/_tiProxy'
import { proxyCaseAction } from '../../caseProxyContract'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params
    return proxyCaseAction(request, id, 'customer-notification', proxyTiRequest)
}
