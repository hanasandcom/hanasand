import Users from '@/components/users/users'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import fetchUsers from '@/utils/users/fetchUsers'
import { DashboardPage } from '@/components/dashboard/ui'
import DashboardMetricCard from '@/components/dashboard/dashboardMetricCard'
import { UserRound, UsersRound } from 'lucide-react'
import { countReservedPlaceholders } from '@/utils/users/isReservedPlaceholder'

export default async function Page() {
    const Cookies = await cookies()
    const id = Cookies.get('id')?.value
    const token = Cookies.get('access_token')?.value || ''
    if (!Cookies.get('name')?.value || !id || !token) {
        return redirect('/logout?path=/login%3Fpath%3D/dashboard%26expired=true')
    }

    const users = await fetchUsers({ id, token, cache: 'no-store' })
    const reservedCount = countReservedPlaceholders(users)
    const currentUser = users.find(user => user.id === id)
    const accessibleOrganizationIds = currentUser?.active === false ? [] : (currentUser?.organization_memberships || [])
        .filter(organization => organization.status === 'active')
        .map(organization => organization.id)

    return (
        <DashboardPage>
            <section className='grid gap-3 md:grid-cols-2'>
                <DashboardMetricCard density='compact' tone='neutral' icon={<UsersRound className='h-4 w-4' />} label='Users' value={String(users.length)} detail='Registered accounts' />
                <DashboardMetricCard density='compact' tone='neutral' icon={<UserRound className='h-4 w-4' />} label='Reserved' value={String(reservedCount)} detail='Reserved accounts' />
            </section>
            <Users users={users} accessibleOrganizationIds={accessibleOrganizationIds} />
        </DashboardPage>
    )
}
