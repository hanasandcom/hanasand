import type { OrganizationSummary } from '../types/organization'
import type { OrgBundle } from '../types/bundle'
import { organizationConfiguredDestinationCount } from '../model/watchlists'
import { organizationLastActivityAt } from '../model/activityLabels'
import { formatDate, organizationRoleLabel } from '../model/labels'
import { secondaryButtonClass } from '../constants/styles'
import { organizationDisplayName } from '../model/organization'
import { organizationNavigationPages, OrganizationPage } from '@/utils/organizations/pages'
import Link from 'next/link'
import { ArrowRight, BellRing, CheckCircle2, ExternalLink, ShieldCheck, Users, Webhook } from 'lucide-react'

export function WorkspaceSectionNav({ activePage }: { activePage: OrganizationPage }) {
    return <nav aria-label='Organization pages' className='flex flex-wrap gap-1 border-b border-ui-border pb-3' data-org-section-nav='true'>
        {organizationNavigationPages.map(page => <Link key={page.id} href={page.href} aria-current={page.id === activePage ? 'page' : undefined}
            className={`rounded-md px-3 py-2 text-sm font-medium transition hover:bg-ui-raised ${page.id === activePage ? 'bg-ui-primary/10 text-ui-primary' : 'text-ui-muted'}`}>{page.label}</Link>)}
    </nav>
}

export function WorkspaceHealthStrip({ organization, bundle }: { organization: OrganizationSummary, bundle: OrgBundle }) {
    const activeMembers = bundle.members.filter(member => member.status.toLowerCase() === 'active')
    const activeTeammates = activeMembers.filter(member => member.role.toLowerCase() !== 'owner')
    const ownerMembers = activeMembers.filter(member => member.role.toLowerCase() === 'owner')
    const activeTerms = bundle.alertTerms.filter(term => (term.status || 'active').toLowerCase() === 'active')
    const configuredDestinations = organizationConfiguredDestinationCount(bundle)
    const openCases = bundle.cases.filter(item => !['closed', 'resolved', 'false_positive', 'suppressed'].includes((item.status || 'open').toLowerCase()))
    const lastActivityAt = organizationLastActivityAt(organization, bundle)
    const rows = [
        {
            id: 'access',
            label: 'Members',
            value: `${activeMembers.length} member${activeMembers.length === 1 ? '' : 's'}`,
            detail: `${ownerMembers.length} owner${ownerMembers.length === 1 ? '' : 's'} · ${activeTeammates.length} teammate${activeTeammates.length === 1 ? '' : 's'}`,
            href: '/organizations/team#members',
        },
        {
            id: 'watchlists',
            label: 'Watchlists',
            value: activeTerms.length ? `${activeTerms.length} active term${activeTerms.length === 1 ? '' : 's'}` : 'Create watchlist',
            detail: activeTerms.length ? `${bundle.watchlists.length} watchlist${bundle.watchlists.length === 1 ? '' : 's'}` : '',
            href: '/organizations/watchlists#watchlists',
        },
        {
            id: 'integrations',
            label: 'Integrations',
            value: `${configuredDestinations} location${configuredDestinations === 1 ? '' : 's'}`,
            detail: `${bundle.deliveries.length} notification${bundle.deliveries.length === 1 ? '' : 's'}`,
            href: '/findings/delivery',
        },
        {
            id: 'cases',
            label: 'Cases',
            value: `${openCases.length} open case${openCases.length === 1 ? '' : 's'}`,
            detail: 'View cases',
            href: openCases[0] ? `/organizations/events#case-record-${encodeURIComponent(openCases[0].id)}` : '/organizations/events',
        },
    ] as const

    return (
        <section className='rounded-lg border border-ui-border bg-ui-panel p-3 shadow-sm dark:border-ui-border dark:bg-ui-panel' data-org-health-strip='true'>
            <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                <div className='min-w-0'>
                    <h2 className='flex items-center gap-2 text-sm font-semibold text-ui-text dark:text-ui-text'>
                        <ShieldCheck className='h-4 w-4 text-ui-primary' />
                        Overview
                    </h2>
                    <p className='mt-1 truncate text-xs text-ui-muted dark:text-ui-muted'>Last activity {lastActivityAt ? formatDate(lastActivityAt) : 'pending'}</p>
                </div>
                <Link href='/organizations/activity#audit' className={secondaryButtonClass} data-org-health-activity='true'>
                    <ExternalLink className='h-4 w-4' />
                    Activity
                </Link>
            </div>
            <div className='mt-3 overflow-hidden rounded-lg border border-ui-border dark:border-ui-border' data-org-health-compact='true'>
                {rows.map(row => (
                    <Link
                        key={row.id}
                        href={row.href}
                        className='group grid min-h-12 min-w-0 grid-cols-[minmax(6rem,0.75fr)_minmax(0,1fr)_auto] items-center gap-3 border-b border-ui-border bg-ui-panel px-3 py-2 text-sm transition last:border-b-0 hover:bg-ui-raised dark:border-ui-border dark:bg-ui-panel dark:hover:bg-ui-raised'
                        data-org-health-row={row.id}
                    >
                        <span className='min-w-0'>
                            <span className='block truncate text-xs font-semibold uppercase tracking-[0.08em] text-ui-muted dark:text-ui-muted'>{row.label}</span>
                            <span className='mt-0.5 block truncate text-sm font-semibold text-ui-text dark:text-ui-text'>{row.value}</span>
                        </span>
                        <span className='min-w-0 truncate text-xs text-ui-muted dark:text-ui-muted'>{row.detail}</span>
                        <ArrowRight aria-hidden='true' className='h-4 w-4 text-ui-text transition-transform group-hover:translate-x-0.5' />
                    </Link>
                ))}
            </div>
        </section>
    )
}

export function EmptyWorkspacePreview() {
    return (
        <ul className='grid w-full gap-3 text-sm font-normal text-ui-muted sm:grid-cols-3 sm:justify-items-center dark:text-ui-muted' aria-label='Organization benefits' data-org-empty-focused-create='true'>
            {['Dark web monitoring', 'Shared browser runs', 'Team event and case workflows'].map(benefit => (
                <li key={benefit} className='flex items-center gap-2'>
                    <CheckCircle2 className='h-4 w-4 shrink-0 text-ui-success' />
                    <span>{benefit}</span>
                </li>
            ))}
        </ul>
    )
}

export function WorkspaceSummary({ organization, activeWatchlists, pausedWatchlists, memberCount, inviteCount, webhookCount }: { organization: OrganizationSummary, activeWatchlists: number, pausedWatchlists: number, memberCount: number, inviteCount: number, webhookCount: number }) {
    const rows = [
        { id: 'role', icon: <ShieldCheck className='h-4 w-4' />, label: 'Role', value: organizationRoleLabel(organization.role || 'reader') },
        { id: 'members', icon: <Users className='h-4 w-4' />, label: 'Members', value: String(memberCount ?? organization.memberCount ?? organization.activeMemberCount ?? 0), detail: inviteCount ?? organization.pendingInviteCount ?? 0 },
        { id: 'watchlists', icon: <BellRing className='h-4 w-4' />, label: 'Watchlists', value: String(activeWatchlists ?? organization.sharedWatchlistCount ?? 0), detail: pausedWatchlists },
        { id: 'destinations', icon: <Webhook className='h-4 w-4' />, label: 'Destinations', value: String(webhookCount) },
    ]
    return (
        <section className='flex min-w-0 flex-col gap-3 rounded-lg border border-ui-border bg-ui-panel p-3 shadow-sm dark:border-ui-border dark:bg-ui-panel xl:flex-row xl:items-center xl:justify-between' data-org-workspace-summary='true'>
            <div className='min-w-0'>
                <p className='flex min-w-0 items-center gap-2 text-sm font-semibold text-ui-text dark:text-ui-text'>
                    <ShieldCheck className='h-4 w-4 shrink-0 text-ui-primary' />
                    <span className='truncate'>{organizationDisplayName(organization)}</span>
                </p>
            </div>
            <div className='hidden min-w-0 gap-2 sm:grid sm:grid-cols-2 xl:ml-6 xl:flex-1 xl:grid-cols-4' data-org-summary-chip-list='true'>
                {rows.map(row => (
                    <span key={row.id} className='grid min-h-10 min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 border-l border-ui-border py-1 pl-2 dark:border-ui-border' data-org-summary-chip={row.id}>
                        <span className='shrink-0 text-ui-muted dark:text-ui-muted'>{row.icon}</span>
                        <span className='min-w-0'>
                            <span className='block truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-ui-muted dark:text-ui-muted'>{row.label}</span>
                            <span className='block truncate text-sm font-semibold text-ui-text dark:text-ui-text'>{row.value}{row.id === 'members' && Number(row.detail) > 0 ? <> <Link href='/organizations/team#invites' className='font-medium text-ui-muted hover:text-ui-primary dark:text-ui-muted dark:hover:text-ui-primary'>{row.detail} pending</Link></> : null}{row.id === 'watchlists' && Number(row.detail) > 0 ? <> <Link href='/organizations/watchlists#watchlists' className='font-medium text-ui-muted hover:text-ui-primary dark:text-ui-muted dark:hover:text-ui-primary'>{row.detail} paused</Link></> : null}</span>
                        </span>
                    </span>
                ))}
            </div>
        </section>
    )
}
