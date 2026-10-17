import { expect, test } from 'bun:test'
import type { OrganizationInvite, OrganizationMember } from '../src/app/organizations/types/organization'
import { inviteRoleStatusCounts, inviteStatusCounts, memberRoleStatusCounts, memberStatusCounts } from '../src/app/organizations/model/forms'

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
