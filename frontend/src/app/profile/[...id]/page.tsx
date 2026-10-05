import ProfileIdentity from '@/components/profile/profileIdentity'
import ProfileOverview from '@/components/profile/profileOverview'
import getProfileStats from '@/utils/profile/getProfileStats'
import { redirect, notFound } from 'next/navigation'
import SshKeys from '@/components/profile/sshKeys'
import AccountActions from '@/components/profile/accountActions'
import SessionsPanel from '@/components/profile/sessions'
import SupportTickets from '@/components/profile/supportTickets'
import { DashboardPanel, DashboardPage } from '@/components/dashboard/ui'
import fetchUser from '@/utils/users/fetchUser'
import OrganizationProfile from '@/components/profile/organizationProfile'
import { cookies } from 'next/headers'
import config from '@/config'
import type { AuthSession } from '@/utils/auth/sessions'
import { Suspense } from 'react'
import { getProfileSshKeys } from '@/utils/sshKeys'

export default async function Page(props: { params: Promise<{ id: string[] }> }) {
    const params = await props.params
    const profileId = params.id[0]
    const section = params.id[1] || 'profile'
    const sections = ['profile', 'security', 'sessions', 'certificates', 'ssh-keys', 'support']
    if (params.id.length > 2 || !sections.includes(section)) notFound()
    const Cookies = await cookies()
    const name = Cookies.get('name')?.value
    const userId = Cookies.get('id')?.value
    const token = Cookies.get('access_token')?.value
    if (!userId || !token) notFound()
    if (section === 'certificates') redirect(`/profile/${encodeURIComponent(profileId)}/ssh-keys`)

    const isSelfProfile = profileId === userId
    const isSelfSessionsPage = section === 'sessions' && isSelfProfile
    const [profile, initialSessions] = await Promise.all([
        isSelfProfile ? Promise.resolve(null) : fetchUser(profileId, { id: userId, token }),
        isSelfSessionsPage ? loadSessionsForRender(userId, token) : Promise.resolve(undefined),
    ])
    if (!profile && !isSelfProfile) notFound()

    const username = profile?.username || profile?.id || profileId
    const isSelf = isSelfProfile || profile?.id === userId
    if (profile && profileId !== username) redirect(`/profile/${encodeURIComponent(username)}${section === 'profile' ? '' : `/${section}`}`)

    if (!isSelf && profile) return <DashboardPage><OrganizationProfile key={username} profile={profile} username={username} /></DashboardPage>
    if (!isSelf) notFound()

    const displayName = profile?.name || name || profileId
    const stats = section === 'profile' ? await getProfileStats(userId, token) : null
    return (
        <DashboardPage>
            {section === 'profile' ? (
                <DashboardPanel className='relative p-4'>
                    <h1 className='wrap-break-word pr-10 text-xl font-semibold text-ui-text'>{displayName}</h1>
                    <p className='mt-1 break-all pr-10 text-sm text-ui-muted'>@{username}</p>
                    {profile?.email && <p className='mt-2 break-all text-sm text-ui-muted'>{profile.email}</p>}
                    <ProfileIdentity displayName={displayName} username={username} />
                    {profile?.active === false && <p className='mt-2 text-sm text-ui-muted'>Inactive account</p>}
                </DashboardPanel>
            ) : <p className='px-1 text-xs text-ui-muted'>@{username}</p>}
            {section === 'profile' && <ProfileOverview stats={stats} />}
            {section === 'sessions' && <SessionsPanel isSelf initialSessions={initialSessions ?? undefined} />}
            {section === 'ssh-keys' && <Suspense fallback={<SshKeysLoading />}><ProfileSshKeys id={userId} token={token} /></Suspense>}
            {section === 'support' && <SupportTickets />}
            {section === 'security' && <AccountActions isSelf />}
        </DashboardPage>
    )
}

async function ProfileSshKeys({ id, token }: { id: string, token: string }) {
    const keys = await getProfileSshKeys(id, token)
    return <SshKeys initialKeys={keys} />
}

function SshKeysLoading() {
    return <DashboardPanel className='h-fit p-4'>
        <h1 className='text-base font-semibold text-ui-text'>SSH Keys</h1>
        <p className='mt-1 text-sm text-ui-muted'>Loading keys…</p>
        <p role='status' aria-busy='true' className='mt-4 rounded-lg border border-ui-border bg-ui-raised p-4 text-sm text-ui-muted'>Loading SSH keys…</p>
    </DashboardPanel>
}

async function loadSessionsForRender(id: string, token: string): Promise<AuthSession[] | null> {
    try {
        const response = await fetch(`${config.url.api}/auth/sessions`, {
            headers: { id, Authorization: `Bearer ${decodeURIComponent(token)}` },
            cache: 'no-store',
            signal: AbortSignal.timeout(config.abortTimeout),
        })
        if (!response.ok) return null
        const body = await response.json() as { sessions?: unknown }
        return Array.isArray(body.sessions) ? body.sessions as AuthSession[] : null
    } catch {
        return null
    }
}
