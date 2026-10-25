import VmConsole from '@/components/vms/consoleClient'
import { DashboardPage } from 'hanasand/dashboard'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { activeOrganizationId } from '@/utils/organizations/serverWorkspace'
import getVM from '@/utils/vms/fetch/getVM'

export default async function Page({ params }: { params: Promise<{ name: string }> }) {
    const { name } = await params
    const store = await cookies()
    const token = store.get('access_token')?.value
    const userId = store.get('id')?.value
    if (!token || !userId) redirect('/vms')

    const organizationId = await activeOrganizationId()
    const rows = await getVM(name, token, userId, organizationId || null)
    const vm = Array.isArray(rows) ? rows[0] : null
    if (!vm || vm.name.toLowerCase() !== name.toLowerCase() || (vm.organization_id || null) !== (organizationId || null)) redirect('/vms')

    return <DashboardPage><VmConsole name={name} workspaceOrganizationId={organizationId || ''} /></DashboardPage>
}
