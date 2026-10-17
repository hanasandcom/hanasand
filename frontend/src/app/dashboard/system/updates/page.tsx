import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { systemExpiredSessionPath } from '../systemRoutes'
import { DashboardHeader, DashboardPage } from '@/components/dashboard/ui'
import AptUpdatesClient from './pageClient'

export default async function Page() {
    const cookieStore = await cookies()
    if (!cookieStore.get('id')?.value || !cookieStore.get('access_token')?.value) {
        return redirect(systemExpiredSessionPath('/system/updates'))
    }
    return <DashboardPage className='h-full'><DashboardHeader title='Host updates' description='Monitor Ubuntu updates on Inspur and OVH, with a three-day review window for regular packages and immediate installation for verified Ubuntu security updates.' /><AptUpdatesClient /></DashboardPage>
}
