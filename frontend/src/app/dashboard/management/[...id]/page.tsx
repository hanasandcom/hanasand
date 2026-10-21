import VMDetailClient from '@/components/vms/vmClientDetails'
import getVM from '@/utils/vms/fetch/getVM'
import getVMMetrics from '@/utils/vms/fetch/metrics/getVMMetrics'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { DashboardPage } from '@/components/dashboard/ui'
import { activeOrganizationId } from '@/utils/organizations/serverWorkspace'

export default async function Page(props: { params: Promise<{ id: string[] }> }) {
    const params = await props.params
    const id = params.id[0]
    const Cookies = await cookies()
    const token = Cookies.get('access_token')?.value
    const userId = Cookies.get('id')?.value
    if (!userId || !token) {
        return redirect(`/logout?path=/login%3Fpath%3D/management/${id}%26expired=true`)
    }

    const organizationId = await activeOrganizationId()
    const [vmResponse, metrics] = await Promise.all([
        getVM(id, token, userId, organizationId),
        getVMMetrics(id, token, userId, organizationId),
    ])
    const vm = Array.isArray(vmResponse) && vmResponse.length ? vmResponse[0] : null

    if (!vm) {
        return null
    }

    return (
        <DashboardPage>
            <VMDetailClient vm={vm} metrics={metrics} />
        </DashboardPage>
    )
}
