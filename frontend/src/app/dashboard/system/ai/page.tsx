import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { systemExpiredSessionPath } from '../systemRoutes'
import GPT_Page from './pageClient'

export default async function Page() {
    const Cookies = await cookies()
    const id = Cookies.get('id')?.value
    const token = Cookies.get('access_token')?.value

    if (!id || !token) {
        return redirect(systemExpiredSessionPath('/system/ai'))
    }

    return <GPT_Page />
}
