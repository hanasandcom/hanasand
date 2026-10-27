import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { systemExpiredSessionPath } from '../systemRoutes'
import { DashboardPage } from 'hanasand/dashboard'
import HostConsoleClient from './pageClient'

export default async function Page(props: { searchParams: Promise<{ host?: string }> }) {
    const cookieStore = await cookies()
    if (!cookieStore.get('id')?.value || !cookieStore.get('access_token')?.value) {
        return redirect(systemExpiredSessionPath('/system/console'))
    }
    const searchParams = await props.searchParams
    if (searchParams.host !== 'ovh') return redirect('/system/hosts')
    return <DashboardPage className='h-full'><HostConsoleClient /></DashboardPage>
}
