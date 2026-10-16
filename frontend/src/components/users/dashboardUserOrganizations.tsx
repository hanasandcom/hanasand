'use client'

import Link from 'next/link'
import { useId, useRef, useState } from 'react'

type OrganizationMembership = NonNullable<User['organization_memberships']>[number]

export default function DashboardUserOrganizations({
    organizations,
    accessibleOrganizationIds,
    userName,
}: {
    organizations: OrganizationMembership[]
    accessibleOrganizationIds: string[]
    userName: string
}) {
    const popoverId = useId()
    const popover = useRef<HTMLDivElement>(null)
    const [open, setOpen] = useState(false)

    function positionPopover(event: React.MouseEvent<HTMLButtonElement>) {
        event.stopPropagation()
        const rect = event.currentTarget.getBoundingClientRect()
        if (!popover.current) return
        popover.current.style.top = `${Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - 280))}px`
        popover.current.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 296))}px`
    }

    return (
        <div className='dashboard-user-organizations text-xs text-ui-muted' onClick={event => event.stopPropagation()}>
            <span className='dashboard-user-mobile-label'>Orgs</span>
            {organizations.length ? <button
                type='button'
                aria-label={`Show ${organizations.length} organizations for ${userName}`}
                aria-expanded={open}
                popoverTarget={popoverId}
                onClick={positionPopover}
                className='rounded px-1.5 py-1 font-semibold text-ui-primary hover:bg-ui-raised focus-visible:outline-2 focus-visible:outline-ui-primary'
            >{organizations.length}</button> : <span>0</span>}
            <div
                ref={popover}
                id={popoverId}
                popover='auto'
                aria-label={`Organizations for ${userName}`}
                onToggle={event => setOpen(event.newState === 'open')}
                onClick={event => event.stopPropagation()}
                className='fixed m-0 max-h-[min(70vh,24rem)] w-72 max-w-[calc(100vw-1rem)] overflow-y-auto rounded-lg border border-ui-border bg-ui-panel p-2 text-sm text-ui-text shadow-xl'
            >
                <ul className='grid gap-1'>
                    {organizations.map(organization => <li key={organization.id}>
                        {organization.status === 'active' && accessibleOrganizationIds.includes(organization.id)
                            ? <Link href={`/organizations?organizationId=${encodeURIComponent(organization.id)}`} className='block rounded-md px-2 py-1.5 hover:bg-ui-raised focus-visible:outline-2 focus-visible:outline-ui-primary'>{organization.name}</Link>
                            : <span className='block rounded-md px-2 py-1.5 text-ui-muted'>{organization.name}</span>}
                    </li>)}
                </ul>
            </div>
        </div>
    )
}
