import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { DashboardHeader, DashboardPage } from '@/components/dashboard/ui'
import MailClient from './mailClient'

export const dynamic = 'force-dynamic'

export default async function Page(props: { searchParams: Promise<{ mailboxUser?: string }> }) {
    const searchParams = await props.searchParams
    const cookieStore = await cookies()
    const id = cookieStore.get('id')?.value
    const token = cookieStore.get('access_token')?.value

    if (!id || !token) {
        redirect('/logout?path=/login%3Fpath%3D/mail%26expired=true')
    }

    return (
        <DashboardPage>
            <DashboardHeader eyebrow='Personal' title='Mail' description='Read and send mail from your Hanasand account.' />
            <MailClient mailboxUser={searchParams.mailboxUser || null} />
        </DashboardPage>
    )
}
