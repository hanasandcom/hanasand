'use client'

import useClearStateAfter from '@/hooks/useClearStateAfter'
import DeleteAccountButton from './deleteAccountButton'
import AccountDate from './accountDate'
import deleteUser from '@/utils/users/deleteUser'
import { startImpersonating } from '@/utils/impersonation/client'
import setUserActive from '@/utils/users/setUserActive'
import { Ban, CheckCircle2, MoreHorizontal, UserRound } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useId, useRef, useState } from 'react'
import ErrorNotice from '../error/errorNotice'
import DashboardUserOrganizations from './dashboardUserOrganizations'
import './usersList.css'

export default function DashboardUser({ user, accessibleOrganizationIds }: { user: User, accessibleOrganizationIds: string[] }) {
    const { condition: deleted, setCondition: setDeleted } = useClearStateAfter()
    const router = useRouter()
    const actions = useRef<HTMLDivElement>(null)
    const actionsId = useId()
    const [actionsOpen, setActionsOpen] = useState(false)
    const { condition: error, setCondition: setError } = useClearStateAfter()
    const [impersonationPending, setImpersonationPending] = useState(false)

    async function handleActive(e: React.MouseEvent<HTMLButtonElement, MouseEvent>) {
        e.stopPropagation()
        e.preventDefault()
        actions.current?.hidePopover()
        const result = await setUserActive(user.id, user.active === false)
        if (result.status === 200) {
            router.refresh()
        } else {
            setError(result.message || 'Unable to update user.')
        }
    }

    async function handleImpersonate(e: React.MouseEvent<HTMLButtonElement, MouseEvent>) {
        e.stopPropagation()
        e.preventDefault()
        actions.current?.hidePopover()
        setImpersonationPending(true)
        try {
            await startImpersonating(user.id)
            router.refresh()
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Unable to start impersonation.')
        } finally {
            setImpersonationPending(false)
        }
    }

    async function handleDelete() {
        const result = await deleteUser(user.id)
        if (result.status !== 200) throw new Error(result.message)
        setDeleted(true)
        router.refresh()
    }

    const organizations = user.organization_memberships || []

    return (
        <div className='dashboard-user-row group relative h-10 min-h-10 max-h-10'>
            <div onClick={() => router.push(`/profile/${encodeURIComponent(user.id)}`)} className='dashboard-user-row-main grid cursor-pointer grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)_72px_100px_100px_40px] items-center gap-3 rounded-lg py-2 hover:bg-ui-raised'>
                <h1 className={`dashboard-user-name min-w-0 truncate ${user.active === false ? 'text-ui-muted line-through' : ''}`} key={user.id}>{user.name}</h1>
                <span className={`dashboard-user-username min-w-0 truncate text-sm text-ui-muted ${user.active === false ? 'line-through' : ''}`}>{user.username || user.id}</span>
                <span className='dashboard-user-email min-w-0 truncate text-sm text-ui-muted' title={user.email || undefined}><span className='dashboard-user-mobile-label'>Email</span>{user.email || '—'}</span>
                <DashboardUserOrganizations
                    organizations={organizations}
                    accessibleOrganizationIds={accessibleOrganizationIds}
                    userName={user.name || user.id}
                />
                <span className='dashboard-user-created text-xs text-ui-muted'><span className='dashboard-user-mobile-label'>Created</span><AccountDate value={user.created_at} /></span>
                <span className='dashboard-user-last-login text-xs text-ui-muted'><span className='dashboard-user-mobile-label'>Last login</span><AccountDate value={user.last_login_at} empty='Never recorded' /></span>
                <button
                    type='button'
                    aria-label={`Actions for ${user.id}`}
                    aria-expanded={actionsOpen}
                    popoverTarget={actionsId}
                    onClick={(event) => {
                        event.stopPropagation()
                        const rect = event.currentTarget.getBoundingClientRect()
                        if (actions.current) {
                            actions.current.style.top = `${Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - 200))}px`
                            actions.current.style.left = `${Math.max(8, rect.right - 208)}px`
                        }
                    }}
                    className='dashboard-user-actions grid h-9 w-9 place-items-center rounded-lg text-ui-muted hover:bg-ui-raised focus-visible:outline-2 focus-visible:outline-ui-primary [@media(hover:hover)]:opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 aria-expanded:opacity-100'
                ><MoreHorizontal className='h-5 w-5' /></button>
                <div ref={actions} id={actionsId} popover='auto' aria-label={`Actions for ${user.id}`}
                    onToggle={event => setActionsOpen(event.newState === 'open')}
                    onClick={event => event.stopPropagation()}
                    onKeyDown={event => { if (event.key === 'Escape') event.stopPropagation() }}
                    className='fixed m-0 w-52 rounded-lg border border-ui-border bg-ui-panel p-1 text-sm text-ui-text shadow-xl'>
                    <button type='button' autoFocus onClick={handleImpersonate} disabled={impersonationPending}
                        aria-label={`Impersonate ${user.id}`} className='flex w-full items-center gap-2 rounded-md px-3 py-2 text-left hover:bg-ui-raised'>
                        <UserRound className='h-4 w-4' />{impersonationPending ? 'Checking' : 'Impersonate'}
                    </button>
                    <button type='button' onClick={handleActive} aria-label={`${user.active === false ? 'Activate' : 'Deactivate'} ${user.id}`}
                        className='flex w-full items-center gap-2 rounded-md px-3 py-2 text-left hover:bg-ui-raised'>
                        {user.active === false ? <CheckCircle2 className='h-4 w-4' /> : <Ban className='h-4 w-4' />}{user.active === false ? 'Activate' : 'Deactivate'}
                    </button>
                    <DeleteAccountButton name={user.id} onDelete={handleDelete} label='Delete user' />
                </div>
            </div>
            {deleted ? <ErrorNotice compact variant='success' className='absolute right-2 top-12 z-[100] w-60' message={`Deleted user ${user.id}.`} /> : null}
            {error ? <ErrorNotice compact className='absolute right-2 top-12 z-[100] w-60' message={String(error)} /> : null}
        </div>
    )
}
