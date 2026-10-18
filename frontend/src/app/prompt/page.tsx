import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import tokenIsValid from '@/utils/proxy/tokenIsValid'
import { isHanasandOrganizationMember } from '@/utils/organizations/hanasandMembership'
import { publicPromptPortalState, readPromptPortalState } from '@/utils/promptPortal/store'
import PromptPortalClient from './promptPortalClient'

export const metadata = {
    title: 'Prompt portal',
}

export default async function PromptPortalPage() {
    const session = await cookies()
    const token = session.get('access_token')?.value
    const id = session.get('id')?.value
    if (!token || !id) redirect('/login?path=/prompt')

    const validation = await tokenIsValid(token, id, session.get('impersonation_token')?.value)
    if (!validation.valid) redirect('/logout?path=/login%3Fpath%3D/prompt%26expired=true')
    if (!validation.canViewInternalPages) redirect('/dashboard?notAllowed=true')
    let isMember = false
    try {
        isMember = await isHanasandOrganizationMember(validation.token || token, id)
    } catch {
        redirect('/dashboard?organizationCheckUnavailable=true')
    }
    if (!isMember) redirect('/dashboard?notAllowed=true')

    const state = await readPromptPortalState()
    return <PromptPortalClient initialState={publicPromptPortalState(state)} />
}
