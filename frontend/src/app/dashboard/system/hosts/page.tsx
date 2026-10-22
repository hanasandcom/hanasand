import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { systemExpiredSessionPath } from '../systemRoutes'
import { DashboardPage } from 'hanasand/dashboard'
import HostsOverview from './pageClient'

export default async function Page() {
    const cookieStore = await cookies()
    if (!cookieStore.get('id')?.value || !cookieStore.get('access_token')?.value) {
        return redirect(systemExpiredSessionPath('/system/hosts'))
    }
    return <DashboardPage>
        <HostsOverview />
    </DashboardPage>
}
