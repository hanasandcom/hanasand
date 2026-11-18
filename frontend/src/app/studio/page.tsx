import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { loadStudio } from '@/utils/studio'
import { isHanasandOrganizationMember } from '@/utils/organizations/hanasandMembership'
import StudioClient from './studioClient'
import GameChatBubble from './gameChatBubble'

export const metadata = { title: 'Studio | Hanasand' }
export const dynamic = 'force-dynamic'

export default async function StudioPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
    const raw = (await searchParams).page
    const page = raw === undefined ? 1 : Number(raw)
    if (!Number.isSafeInteger(page) || page < 1 || page > 32767) notFound()
    const cookieStore = await cookies()
    const token = cookieStore.get('access_token')?.value
    const id = cookieStore.get('id')?.value
    const document = await loadStudio(page)
    if (!document) notFound()
    const canEdit = token && id ? await isHanasandOrganizationMember(token, id).catch(() => false) : false
    return <><StudioClient key={page} initialDocument={document} canEdit={canEdit} /><GameChatBubble /></>
}
