import type { Dispatch, SetStateAction } from 'react'
import type { OrganizationSummary } from './types/organization'
import type { OrganizationRole } from './types/organization'
import type { WatchlistKind } from './types/watchlists'
import type { WorkspaceAction } from './useWorkspaceActionRunner'
import { endpointErrorMessage } from './model/labels'
import * as forms from './model/forms'
import { requestJson } from './model/workspaceApi'
import { replaceOrganizationWorkspaceSelectionUrl } from './model/activityNavigation'

type CreationOptions = {
    runAction: WorkspaceAction
    organizations: OrganizationSummary[]
    createName: string
    createFirstWatchlist: { kind: WatchlistKind, value: string, notes: string }
    createInviteEmails: string
    createInviteRole: OrganizationRole
    setCreateName: Dispatch<SetStateAction<string>>
    setCreateFormOpen: Dispatch<SetStateAction<boolean>>
    setCreateFirstWatchlist: Dispatch<SetStateAction<{ kind: WatchlistKind, value: string, notes: string }>>
    setCreateInviteEmails: Dispatch<SetStateAction<string>>
    setCreateInviteRole: Dispatch<SetStateAction<OrganizationRole>>
    switchOrganization: (organizationId: string) => Promise<void>
}

export function createOrganizationAction(options: CreationOptions) {
    const { runAction, organizations, createName, createFirstWatchlist, createInviteEmails,
        createInviteRole, setCreateName, setCreateFormOpen, setCreateFirstWatchlist,
        setCreateInviteEmails, setCreateInviteRole, switchOrganization } = options
    const { organizationNameInUse, normalizeOrganizationName, parseInviteEmails, invalidInviteEmails } = forms
    return () => runAction('create-org', async () => {
        const name = normalizeOrganizationName(createName)
        const firstWatchlistValue = createFirstWatchlist.value.trim()
        const firstInviteEmails = parseInviteEmails(createInviteEmails)
        const invalidFirstInvites = invalidInviteEmails(createInviteEmails)
        if (!name) throw new Error('Enter an organization name.')
        if (organizationNameInUse(organizations, name)) throw new Error('An organization with this name already exists.')
        if (invalidFirstInvites.length) throw new Error(`Invalid email: ${invalidFirstInvites[0]}`)
        const payload = await requestJson<{ organization?: OrganizationSummary }>('/api/organizations', {
            method: 'POST',
            body: JSON.stringify({ name }),
        })
        const organizationId = payload.organization?.id
        if (!organizationId) throw new Error('Organization was created, but the API did not return an organization id.')
        let firstWatchlistAdded = false
        let firstInviteCount = 0
        const setupWarnings: string[] = []
        if (firstWatchlistValue) {
            try {
                await requestJson(`/api/organizations/${encodeURIComponent(organizationId)}/watchlists`, {
                    method: 'POST',
                    body: JSON.stringify({
                        kind: createFirstWatchlist.kind,
                        value: firstWatchlistValue,
                        notes: createFirstWatchlist.notes.trim() || 'Initial shared watchlist term from organization setup.',
                        reason: 'Initial shared watchlist term added from organization setup.',
                        requestId: `org-ui-create-${Date.now()}`,
                    }),
                })
                firstWatchlistAdded = true
            } catch (err) {
                setupWarnings.push(`shared term failed: ${endpointErrorMessage(err)}`)
            }
        }
        if (firstInviteEmails.length) {
            try {
                await requestJson(`/api/organizations/${encodeURIComponent(organizationId)}/invites`, {
                    method: 'POST',
                    body: JSON.stringify({
                        emails: firstInviteEmails,
                        role: createInviteRole,
                        requestId: `org-ui-create-invite-${Date.now()}`,
                    }),
                })
                firstInviteCount = firstInviteEmails.length
            } catch (err) {
                setupWarnings.push(`invites failed: ${endpointErrorMessage(err)}`)
            }
        }
        await switchOrganization(organizationId)
        replaceOrganizationWorkspaceSelectionUrl(organizationId, { type: 'organization', id: organizationId })
        setCreateName('')
        setCreateFormOpen(false)
        if (!firstWatchlistValue || firstWatchlistAdded) setCreateFirstWatchlist({ kind: 'domain', value: '', notes: '' })
        if (!firstInviteEmails.length || firstInviteCount) {
            setCreateInviteEmails('')
            setCreateInviteRole('reader')
        }
        return {
            organizationId,
            warning: setupWarnings.length > 0,
            message: [
                'Organization created',
                firstWatchlistAdded ? 'shared term added' : '',
                firstInviteCount ? `${firstInviteCount} invite${firstInviteCount === 1 ? '' : 's'} sent` : '',
                ...setupWarnings,
            ].filter(Boolean).join(', ') + '.',
        }
    }, 'organization-create')
}
