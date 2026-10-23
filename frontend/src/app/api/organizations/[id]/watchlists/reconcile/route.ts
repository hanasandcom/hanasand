import { NextRequest } from 'next/server'
import { proxyOrganizationWatchlistMutation } from '@/app/api/organizations/_organizationWatchlistDwmBridge'
import { GET as getItem, PUT as putItem, DELETE as deleteItem } from '../[itemId]/route'

export const dynamic = 'force-dynamic'
type Context = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: Context) {
    const { id } = await context.params
    return proxyOrganizationWatchlistMutation(request, `/organizations/${encodeURIComponent(id)}/watchlists/reconcile`, { method: 'POST', organizationId: id })
}

// Preserve legacy items whose ID matches this command's static route segment.
async function itemContext(context: Context) {
    return { params: Promise.resolve({ ...await context.params, itemId: 'reconcile' }) }
}
export async function GET(request: NextRequest, context: Context) { return getItem(request, await itemContext(context)) }
export async function PUT(request: NextRequest, context: Context) { return putItem(request, await itemContext(context)) }
export async function DELETE(request: NextRequest, context: Context) { return deleteItem(request, await itemContext(context)) }
