import { NextRequest, NextResponse } from 'next/server'
import requireApiSession from '@/utils/proxy/requireApiSession'
import { activeOrganizationId } from '@/utils/organizations/serverWorkspace'
import getVM from '@/utils/vms/fetch/getVM'
import { issueVmConsoleWorkspaceTicket } from '@/utils/vms/consoleWorkspaceTicket'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, context: { params: Promise<{ name: string }> }) {
    const session = await requireApiSession(request)
    if ('response' in session) return session.response
    const { name } = await context.params
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,62}$/.test(name)) {
        return NextResponse.json({ error: 'VM not found in this workspace.' }, { status: 404, headers: { 'cache-control': 'no-store' } })
    }

    const organizationId = await activeOrganizationId()
    const rows = await getVM(name, session.identity.token, session.identity.id, organizationId || null)
    const vm = Array.isArray(rows) ? rows[0] : null
    if (!vm || vm.name.toLowerCase() !== name.toLowerCase() || (vm.organization_id || null) !== (organizationId || null)) {
        return NextResponse.json({ error: 'VM not found in this workspace.' }, { status: 404, headers: { 'cache-control': 'no-store' } })
    }

    try {
        const ticket = issueVmConsoleWorkspaceTicket({ vm: vm.name, userId: session.identity.id, token: session.identity.token, organizationId })
        return NextResponse.json({ ticket }, { headers: { 'cache-control': 'no-store', pragma: 'no-cache' } })
    } catch {
        return NextResponse.json({ error: 'VM console is unavailable.' }, { status: 503, headers: { 'cache-control': 'no-store' } })
    }
}
