import { expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { OrganizationInvite, OrganizationMember } from '../src/app/organizations/types/organization'
import { inviteRoleStatusCounts, inviteStatusCounts, memberRoleStatusCounts, memberStatusCounts } from '../src/app/organizations/model/forms'
import { watchlistStatusCounts } from '../src/app/organizations/model/watchlists'
import { OrganizationCountBadges } from '../src/app/organizations/components/organizationCountBadges'
import type { WatchlistItem } from '../src/app/organizations/types/watchlists'

const invites: OrganizationInvite[] = [
    { id: '1', email: 'one@example.test', role: 'admin', status: 'PENDING' },
    { id: '2', email: 'two@example.test', role: 'reader', status: 'pending' },
    { id: '3', email: 'three@example.test', role: 'admin', status: 'expired' },
]

const members: OrganizationMember[] = [
    { userId: '1', role: 'owner', status: 'ACTIVE' },
    { userId: '2', role: 'admin', status: 'active' },
    { userId: '3', role: 'reader', status: 'removed' },
]

const watchlists: WatchlistItem[] = [
    { id: '1', kind: 'domain', value: 'example.test', status: 'ACTIVE' },
    { id: '2', kind: 'company', value: 'Example', status: 'paused' },
    { id: '3', kind: 'actor', value: 'Actor', status: 'ARCHIVED' },
    { id: '4', kind: 'keyword', value: 'ignored', status: 'unknown' },
]

test('watchlist status counts preserve known statuses and ignore unknown values', () => {
    expect(watchlistStatusCounts(watchlists)).toEqual({ active: 1, paused: 1, archived: 1 })
})

test('invite filter counts preserve option order, labels, and case-insensitive values', () => {
    expect(inviteStatusCounts(invites)).toEqual([
        { status: 'pending', label: 'Pending', count: 2 },
        { status: 'accepted', label: 'Accepted', count: 0 },
        { status: 'revoked', label: 'Revoked', count: 0 },
        { status: 'expired', label: 'Expired', count: 1 },
    ])
    expect(inviteRoleStatusCounts(invites)).toEqual([
        { role: 'admin', label: 'Admin', count: 2 },
        { role: 'editor', label: 'Editor', count: 0 },
        { role: 'reader', label: 'Reader', count: 1 },
    ])
})

test('member filter counts preserve the owner option and status ordering', () => {
    expect(memberStatusCounts(members)).toEqual([
        { status: 'active', label: 'Active', count: 2 },
        { status: 'removed', label: 'Removed', count: 1 },
        { status: 'revoked', label: 'Revoked', count: 0 },
        { status: 'inactive', label: 'Inactive', count: 0 },
    ])
    expect(memberRoleStatusCounts(members)).toEqual([
        { role: 'owner', label: 'Owner', count: 1 },
        { role: 'admin', label: 'Admin', count: 1 },
        { role: 'editor', label: 'Editor', count: 0 },
        { role: 'reader', label: 'Reader', count: 1 },
    ])
})

test('member and invite count rows keep page markers, zero-count policy, and labels', () => {
    const inviteHtml = renderToStaticMarkup(createElement(OrganizationCountBadges, {
        counts: [...inviteStatusCounts(invites), ...inviteRoleStatusCounts(invites)],
        className: 'mt-3 flex flex-wrap gap-2',
        marker: 'data-org-invite-status-counts',
    }))
    const memberHtml = renderToStaticMarkup(createElement(OrganizationCountBadges, {
        counts: [...memberStatusCounts(members), ...memberRoleStatusCounts(members)],
        className: 'mb-3 flex flex-wrap gap-2',
        marker: 'data-org-member-status-counts',
        hideZero: true,
    }))

    expect(inviteHtml).toContain('data-org-invite-status-counts="true"')
    expect(inviteHtml).toContain('mt-3 flex flex-wrap gap-2')
    expect(inviteHtml).toContain('Accepted: 0')
    expect(inviteHtml).toContain('Admin: 2')
    expect(memberHtml).toContain('data-org-member-status-counts="true"')
    expect(memberHtml).toContain('mb-3 flex flex-wrap gap-2')
    expect(memberHtml).toContain('Active: 2')
    expect(memberHtml).not.toContain('Inactive: 0')

    const watchlistHtml = renderToStaticMarkup(createElement(OrganizationCountBadges, {
        counts: [{ label: 'Active', count: 2 }, { label: 'Paused', count: 0 }, { label: 'Archived', count: 1 }],
        className: 'mt-3 flex flex-wrap gap-2',
        marker: 'data-org-watchlist-status-counts',
    }))
    expect(watchlistHtml).toContain('data-org-watchlist-status-counts="true"')
    expect(watchlistHtml).toContain('Paused: 0')
})
