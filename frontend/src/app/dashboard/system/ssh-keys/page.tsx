import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { systemExpiredSessionPath } from '../systemRoutes'

export default async function Page() {
    const cookieStore = await cookies()
    const id = cookieStore.get('id')?.value
    if (!id || !cookieStore.get('access_token')?.value) {
        return redirect(systemExpiredSessionPath('/system/ssh-keys'))
    }
    return redirect(`/profile/${encodeURIComponent(id)}/ssh-keys`)
}
