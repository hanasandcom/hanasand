import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { DashboardPage } from 'hanasand/dashboard'
import NotesClient from './pageClient'

export const dynamic = 'force-dynamic'

export default async function Page() {
    const cookieStore = await cookies()
    const token = cookieStore.get('access_token')?.value

    if (!token) {
        redirect('/logout?path=/login%3Fpath%3D/notes%26expired=true')
    }

    return (
        <DashboardPage>
            <NotesClient />
        </DashboardPage>
    )
}
