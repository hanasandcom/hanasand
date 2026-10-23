'use client'

import { useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { useWorkspace } from '@/components/organizations/workspaceProvider'
import { organizationPageForFocus, type OrganizationPage } from '@/utils/organizations/pages'
import { organizationActivityRows } from './model/activityFeed'
import { organizationConfiguredDestinationCount, isDuplicateWatchlistTerm, watchlistStatusCounts } from './model/watchlists'
import { settingsEqual, parseInviteEmails, invalidInviteEmails } from './model/forms'
import { normalizeOrganizationName, organizationNameInUse, organizationSearchText } from './model/organization'
import { starterWatchlistSuggestions } from './model/organizationSuggestions'
import { organizationLoadErrorsForDisplay } from './model/labels'
import { useOrganizationWorkspaceState } from './useOrganizationWorkspaceState'
import { useOrganizationWorkspaceData } from './useOrganizationWorkspaceData'
import { useWorkspaceActionRunner } from './useWorkspaceActionRunner'
import { createOrganizationAction } from './organizationSetupActions'
import { createOrganizationAccountActions } from './organizationAccountActions'
import { createOrganizationTeamActions } from './organizationTeamActions'
import { createOrganizationWatchlistActions } from './organizationWatchlistActions'
import { CreateOrganizationPanel } from './components/createOrganizationPanel'
import { WorkspaceHeader } from './components/workspaceHeader'
import { WorkspacePage } from './components/workspacePage'
import { OrganizationLoadErrorBanner, StatusBanner } from './components/shared'
import type { OrganizationSummary } from './types/organization'

export { PrivacyLifecyclePanel } from './components/security'
export { alertGenerationReference } from './model/labels'

export default function OrganizationWorkspaceClient({ page = 'overview' }: { page?: OrganizationPage } = {}) {
    const search = useSearchParams()
    const workspace = useWorkspace()
    const requestedOrganizationId = workspace.organizationId
    const requestedWatchlistId = search.get('watchlistItemId')?.trim() || search.get('watchlistId')?.trim() || ''
    const requestedDestinationId = search.get('destinationId')?.trim() || ''
    const requestedDeliveryId = search.get('deliveryId')?.trim() || ''
    const requestedAlertId = search.get('alertId')?.trim() || search.get('alert')?.trim() || ''
    const requestedCaseId = search.get('caseId')?.trim() || ''
    const requestedInviteId = search.get('inviteId')?.trim() || ''
    const requestedMemberId = search.get('memberId')?.trim() || ''
    const requestedFocus = search.get('focus')?.trim() || ''
    const activePage = page === 'overview' ? (requestedDestinationId || requestedDeliveryId ? 'activity'
        : organizationPageForFocus(requestedFocus || (requestedInviteId || requestedMemberId ? 'team'
            : requestedWatchlistId ? 'watchlists' : requestedAlertId || requestedCaseId ? 'events' : 'overview'))) : page
    const state = useOrganizationWorkspaceState({ organizations: workspace.organizations as OrganizationSummary[], loading: workspace.loading, requestedOrganizationId })
    const data = useOrganizationWorkspaceData({
        state, activePage, workspaceOrganizations: workspace.organizations as OrganizationSummary[], workspaceLoading: workspace.loading,
        requestedOrganizationId, requestedFocus, requestedInviteId, requestedMemberId, requestedWatchlistId,
        requestedDestinationId, requestedDeliveryId, requestedAlertId, requestedCaseId, switchOrganization: workspace.switchOrganization,
    })
    const { selectedOrganization, loadOrganizations, loadOrganizationBundle, selectOrganization, selectActivitySubject } = data
    const canManage = ['owner', 'admin'].includes(selectedOrganization?.role?.toLowerCase() || '')
    const canEdit = canManage || selectedOrganization?.role?.toLowerCase() === 'editor'
    const requireManage = () => { if (!canManage) throw new Error('Owner or admin required.') }
    const requireEdit = () => { if (!canEdit) throw new Error('Editor access required.') }
    const { active: activeWatchlistCount, paused: pausedWatchlistCount } = watchlistStatusCounts(state.bundle.watchlists)
    const activeMemberCount = state.bundle.members.filter(item => item.status.toLowerCase() === 'active').length
    const pendingInviteCount = state.bundle.invites.filter(item => item.status.toLowerCase() === 'pending').length
    const configuredDestinationCount = organizationConfiguredDestinationCount(state.bundle)
    const watchlistDraftDuplicate = isDuplicateWatchlistTerm(state.bundle.watchlists, state.watchlistDraft.kind, state.watchlistDraft.value)
    const watchlistSuggestions = selectedOrganization ? starterWatchlistSuggestions(selectedOrganization, state.bundle.watchlists) : []
    const activityRows = useMemo(() => organizationActivityRows(state.activity, state.bundle, selectedOrganization?.id), [state.activity, state.bundle, selectedOrganization?.id])
    const settingsDirty = useMemo(() => !settingsEqual(state.settingsDraft, state.bundle.settings || {}), [state.settingsDraft, state.bundle.settings])
    const normalizedCreateName = normalizeOrganizationName(state.createName)
    const createNameInUse = normalizedCreateName ? organizationNameInUse(state.organizations, normalizedCreateName) : false
    const visibleOrganizations = state.organizations.filter(item => !state.workspaceQuery.trim() || organizationSearchText(item).includes(state.workspaceQuery.trim().toLowerCase()))

    const runAction = useWorkspaceActionRunner({
        selectedOrganization, setBusy: state.setBusy, setError: state.setError, setMessage: state.setMessage,
        setMessageTone: state.setMessageTone, setRowMessages: state.setRowMessages, setActivity: state.setActivity,
        selectActivitySubject, loadOrganizationBundle, loadOrganizations,
    })
    const orgActions = createOrganizationAccountActions({ selectedOrganization, runAction, requireManage,
        setNewApiKeySecret: state.setNewApiKeySecret, settingsDraft: state.settingsDraft, settingsDirty })
    const teamActions = createOrganizationTeamActions({ selectedOrganization, runAction, requireManage,
        inviteEmails: state.inviteEmails, setInviteEmails: state.setInviteEmails, inviteRole: state.inviteRole, bundle: state.bundle })
    const watchlistActions = createOrganizationWatchlistActions({ selectedOrganization, runAction, requireEdit, requireManage,
        watchlistDraft: state.watchlistDraft, setWatchlistDraft: state.setWatchlistDraft, watchlistDraftDuplicate,
        bundle: state.bundle, editingWatchlist: state.editingWatchlist, setEditingWatchlist: state.setEditingWatchlist,
        collectionRequest: state.collectionRequest, setCollectionRequest: state.setCollectionRequest,
        collectionRequestKeyRef: state.collectionRequestKeyRef, loadOrganizationBundle })
    const createOrganization = createOrganizationAction({ runAction, organizations: state.organizations,
        createName: state.createName, createFirstWatchlist: state.createFirstWatchlist, createInviteEmails: state.createInviteEmails,
        createInviteRole: state.createInviteRole, setCreateName: state.setCreateName, setCreateFormOpen: state.setCreateFormOpen,
        setCreateFirstWatchlist: state.setCreateFirstWatchlist, setCreateInviteEmails: state.setCreateInviteEmails,
        setCreateInviteRole: state.setCreateInviteRole, switchOrganization: workspace.switchOrganization })
    const notices = organizationLoadErrorsForDisplay(state.bundle.loadErrors)
    const pageProps = {
        activePage, organization: selectedOrganization, bundle: state.bundle, busy: state.busy, canManage, canEdit,
        activeWatchlistCount, pausedWatchlistCount, activeMemberCount, pendingInviteCount, configuredDestinationCount,
        settingsDraft: state.settingsDraft, setSettingsDraft: state.setSettingsDraft, settingsDirty,
        inviteEmails: state.inviteEmails, setInviteEmails: state.setInviteEmails, inviteRole: state.inviteRole, setInviteRole: state.setInviteRole,
        watchlistDraft: state.watchlistDraft, setWatchlistDraft: state.setWatchlistDraft, watchlistSuggestions, watchlistDraftDuplicate,
        editingWatchlist: state.editingWatchlist, setEditingWatchlist: state.setEditingWatchlist,
        collectionRequest: state.collectionRequest, rowMessages: state.rowMessages, newApiKeySecret: state.newApiKeySecret,
        activity: activityRows, selectedSubject: state.selectedActivitySubject, onSelectSubject: selectActivitySubject,
        onSaveSettings: () => void orgActions.saveSettings(), onCreateInvite: () => void teamActions.sendInvite(),
        onInviteAction: (invite: Parameters<typeof teamActions.inviteAction>[0], action: 'revoke' | 'resend') => void teamActions.inviteAction(invite, action),
        onCopyInvite: (invite: Parameters<typeof teamActions.copyInvite>[0]) => void teamActions.copyInvite(invite),
        onRoleChange: (member: Parameters<typeof teamActions.changeMemberRole>[0], role: Parameters<typeof teamActions.changeMemberRole>[1]) => void teamActions.changeMemberRole(member, role),
        onRemoveMember: (member: Parameters<typeof teamActions.removeMember>[0]) => void teamActions.removeMember(member),
        onCreateWatchlist: () => void watchlistActions.createWatchlist(),
        onSaveWatchlist: (item: Parameters<typeof watchlistActions.saveWatchlistEdit>[0]) => void watchlistActions.saveWatchlistEdit(item),
        onWatchlistAction: (item: Parameters<typeof watchlistActions.watchlistAction>[0], action: Parameters<typeof watchlistActions.watchlistAction>[1]) => void watchlistActions.watchlistAction(item, action),
        onDeleteWatchlist: (item: Parameters<typeof watchlistActions.deleteWatchlist>[0]) => void watchlistActions.deleteWatchlist(item),
        onCleanupWatchlists: (itemIds: string[]) => void watchlistActions.cleanupWatchlists(itemIds), onRefreshAlerts: () => void watchlistActions.refreshOrganizationAlerts(),
        onRequestFreshCollection: () => void watchlistActions.requestFreshCollection(), onRefreshCollectionStatus: () => void watchlistActions.refreshCollectionStatus(),
        onCreateApiKey: (name: string) => void orgActions.createEventApiKey(name),
        onRevokeApiKey: (key: Parameters<typeof orgActions.revokeEventApiKey>[0]) => void orgActions.revokeEventApiKey(key),
        onClearApiKeySecret: () => state.setNewApiKeySecret(''), onResetSettings: () => state.setSettingsDraft(state.bundle.settings || {}),
        onRunRetention: () => void orgActions.runRetention(), onExportPrivacy: () => void orgActions.exportPrivacyData(),
        onDeletePrivacy: (confirmation: string, password: string) => void orgActions.requestPrivacyDeletion(confirmation, password),
    }

    return <section className='min-h-full overflow-x-hidden bg-ui-canvas text-ui-text dark:bg-ui-canvas dark:text-ui-text'>
        <div className='mx-auto flex w-full min-w-0 flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8'>
            <WorkspaceHeader activePage={activePage} organizations={state.organizations} selectedOrganization={selectedOrganization}
                loading={state.loading} busy={state.busy} createFormOpen={state.createFormOpen} setCreateFormOpen={state.setCreateFormOpen}
                createNameRef={state.createNameRef} organizationSearchOpen={state.organizationSearchOpen} setOrganizationSearchOpen={state.setOrganizationSearchOpen}
                workspaceQuery={state.workspaceQuery} setWorkspaceQuery={state.setWorkspaceQuery} organizationSearchRef={state.organizationSearchRef}
                visibleOrganizations={visibleOrganizations} selectOrganization={selectOrganization} loadOrganizations={loadOrganizations} />
            {(state.error || state.message || notices.length > 0) && <div className='grid gap-2'>
                {state.error && <StatusBanner tone='error' text={state.error} />}
                {state.message && <StatusBanner tone={state.messageTone} text={state.message} />}
                {notices.map(item => <OrganizationLoadErrorBanner key={`${item.endpoint}:${item.message}`} error={item} cases={state.bundle.cases} organizationId={selectedOrganization?.id} />)}
            </div>}
            {(state.createFormOpen || (!state.loading && state.organizations.length === 0)) && <CreateOrganizationPanel
                name={state.createName} setName={state.setCreateName} nameRef={state.createNameRef} normalizedName={normalizedCreateName}
                nameInUse={createNameInUse} firstWatchlist={state.createFirstWatchlist} setFirstWatchlist={state.setCreateFirstWatchlist}
                inviteEmails={state.createInviteEmails} setInviteEmails={state.setCreateInviteEmails} inviteRole={state.createInviteRole}
                setInviteRole={state.setCreateInviteRole} invalidEmails={invalidInviteEmails(state.createInviteEmails)}
                parsedEmails={parseInviteEmails(state.createInviteEmails)} busy={state.busy} createOrganization={() => void createOrganization()}
                rowMessage={state.rowMessages['organization-create']} />}
            {(selectedOrganization || state.organizations.length > 0 || (!state.loading && state.organizations.length === 0)) && <main className='min-w-0'><WorkspacePage {...pageProps} /></main>}
        </div>
    </section>
}
