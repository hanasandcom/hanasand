import { redirect } from 'next/navigation'
import { DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import { fetchManagementOrganizations } from '@/utils/organizations/management'
import OrganizationList from './organizationList'

export default async function Page() {
    const response = await fetchManagementOrganizations()
    if (response.status === 401) redirect('/login?path=/management/organizations')
    if (response.status === 403) redirect('/dashboard?notAllowed=true')
    if (!response.ok) throw new Error('Unable to load organizations. Please try again.')
    const { organizations } = await response.json()
    return <DashboardPage className='min-w-0'>
        <DashboardPanel className='min-w-0'><OrganizationList organizations={organizations} /></DashboardPanel>
    </DashboardPage>
}
