import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { DashboardPage } from '@/components/dashboard/ui'

export const dynamic = 'force-dynamic'

export default async function Page(props: { searchParams: Promise<{ mailboxUser?: string }> }) {
    const searchParams = await props.searchParams
    const cookieStore = await cookies()
    const id = cookieStore.get('id')?.value
    const token = cookieStore.get('access_token')?.value

    if (!id || !token) {
        redirect('/logout?path=/login%3Fpath%3D/mail%26expired=true')
    }

    const embedUrl = new URL('https://mail.hanasand.com/embed')
    if (searchParams.mailboxUser) embedUrl.searchParams.set('mailboxUser', searchParams.mailboxUser)

    return <DashboardPage style={{ display: 'flex', height: '100%', minHeight: 0, flexDirection: 'column' }} className='!gap-0 !px-0 !py-0'>
        <iframe
            title='Hanasand Mail'
            src={embedUrl.toString()}
            className='min-h-0 w-full flex-1 border-0 bg-ui-canvas'
            allow='clipboard-write'
        />
    </DashboardPage>
}
