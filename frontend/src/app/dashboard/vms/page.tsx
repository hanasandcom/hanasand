import { Suspense } from 'react'
import VMs from '@/components/profile/vms'
import { DashboardDataFallback, DashboardPage } from '@/components/dashboard/ui'
import getVMs from '@/utils/vms/fetch/getVMs'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { activeOrganizationId } from '@/utils/organizations/serverWorkspace'

export const dynamic = 'force-dynamic'

export default async function Page() {
    const cookieStore = await cookies()
    const headerStore = await headers()
    const id = cookieStore.get('id')?.value
    const token = cookieStore.get('access_token')?.value
    const impersonatingId = cookieStore.get('impersonating_id')?.value || headerStore.get('x-impersonating-id') || ''
    const impersonationToken = cookieStore.get('impersonation_token')?.value || headerStore.get('x-impersonation-token') || ''

    if (!id || !token) {
        return redirect('/logout?path=/login%3Fpath%3D/vms%26expired=true')
    }

    const effectiveId = impersonatingId || id
    return (
        <DashboardPage>
            <div className='w-full min-w-0'>
                <Suspense fallback={<DashboardDataFallback label='virtual machines' />}>
                    <VMData effectiveId={effectiveId} token={token} id={id} impersonationToken={impersonationToken} />
                </Suspense>
            </div>
        </DashboardPage>
    )
}

async function VMData({ effectiveId, token, id, impersonationToken }: { effectiveId: string, token: string, id: string, impersonationToken: string }) {
    const organizationId = await activeOrganizationId()
    const vms = await getVMs(effectiveId, token, id, impersonationToken, organizationId)
    return <VMs vms={vms} initialNow={Date.now()} />
}
