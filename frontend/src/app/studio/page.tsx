import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { loadStudio } from '@/utils/studio'
import StudioClient from './studioClient'

export const metadata = { title: 'Studio | Hanasand' }
export const dynamic = 'force-dynamic'

export default async function StudioPage() {
    const cookieStore = await cookies()
    const token = cookieStore.get('access_token')?.value
    const id = cookieStore.get('id')?.value
    if (!token || !id) redirect('/login?path=%2Fstudio')
    const result = await loadStudio(token, id)
    if (result.state === 'invalid-session') redirect('/logout?path=%2Flogin%3Fpath%3D%252Fstudio%26expired%3Dtrue')
    if (result.state === 'not-member') redirect('/dashboard?notAllowed=true')
    if (result.state !== 'loaded') redirect('/dashboard?notAllowed=true')
    return <StudioClient initialDocument={result.document} />
}
