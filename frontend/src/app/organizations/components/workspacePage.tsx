import type { Dispatch, SetStateAction } from 'react'
import type { ActivityItem, ActivitySubject, CollectionRequest, RowMessage } from '../types/activity'
import type { OrganizationMember, OrganizationRole, OrganizationSettings, OrganizationSummary } from '../types/organization'
import type { WatchlistItem, WatchlistKind, WatchlistSuggestion } from '../types/watchlists'
import type { OrgBundle } from '../types/bundle'
import type { OrganizationPage } from '@/utils/organizations/pages'
import { WorkspaceSectionNav, WorkspaceHealthStrip, EmptyWorkspacePreview, WorkspaceSummary } from './overview'
import { EventApiKeyPanel, SettingsPanel, PrivacyLifecyclePanel } from './security'
import { InvitePanel } from './invites'
import { MemberPanel } from './members'
import { WatchlistPanel } from './watchlists'
import { ScopePanel } from './activity'
import { ActivityPanel } from './activityPanel'
import { SkeletonRows } from './shared'

type WatchlistDraft = { kind: WatchlistKind, value: string, notes: string }
type Props = {
    activePage: OrganizationPage
    organization?: OrganizationSummary
    bundle: OrgBundle
    busy: string
    canManage: boolean
    canEdit: boolean
    activeWatchlistCount: number
    pausedWatchlistCount: number
    activeMemberCount: number
    pendingInviteCount: number
    configuredDestinationCount: number
    settingsDraft: OrganizationSettings
    setSettingsDraft: Dispatch<SetStateAction<OrganizationSettings>>
    settingsDirty: boolean
    inviteEmails: string
    setInviteEmails: Dispatch<SetStateAction<string>>
    inviteRole: OrganizationRole
    setInviteRole: Dispatch<SetStateAction<OrganizationRole>>
    watchlistDraft: WatchlistDraft
    setWatchlistDraft: Dispatch<SetStateAction<WatchlistDraft>>
    watchlistSuggestions: WatchlistSuggestion[]
    watchlistDraftDuplicate: boolean
    editingWatchlist: Record<string, WatchlistDraft>
    setEditingWatchlist: Dispatch<SetStateAction<Record<string, WatchlistDraft>>>
    collectionRequest: CollectionRequest | null
    rowMessages: Record<string, RowMessage>
    newApiKeySecret: string
    activity: ActivityItem[]
    selectedSubject: ActivitySubject
    onSelectSubject: (subject: ActivitySubject) => void
    onSaveSettings: () => void
    onCreateInvite: () => void
    onInviteAction: (invite: OrgBundle['invites'][number], action: 'revoke' | 'resend') => void
    onCopyInvite: (invite: OrgBundle['invites'][number]) => void
    onRoleChange: (member: OrganizationMember, role: OrganizationRole) => void
    onRemoveMember: (member: OrganizationMember) => void
    onCreateWatchlist: () => void
    onSaveWatchlist: (item: WatchlistItem) => void
    onWatchlistAction: (item: WatchlistItem, action: 'pause' | 'resume' | 'archive' | 'restore') => void
    onDeleteWatchlist: (item: WatchlistItem) => void
    onCleanupWatchlists: () => void
    onRefreshAlerts: () => void
    onRequestFreshCollection: () => void
    onRefreshCollectionStatus: () => void
    onCreateApiKey: (name: string) => void
    onRevokeApiKey: (key: OrgBundle['apiKeys'][number]) => void
    onClearApiKeySecret: () => void
    onResetSettings: () => void
    onRunRetention: () => void
    onExportPrivacy: () => void
    onDeletePrivacy: (confirmation: string, currentPassword: string) => void
}

export function WorkspacePage(props: Props) {
    const { activePage, organization, bundle, busy, canManage, canEdit, selectedSubject, onSelectSubject } = props
    if (!organization) return <EmptyWorkspacePreview />
    return <div className='grid min-w-0 content-start gap-5'>
        <WorkspaceSectionNav activePage={activePage} />
        {busy === 'load-org' ? <SkeletonRows count={3} /> : <>
            {activePage === 'overview' && <>
                <WorkspaceSummary organization={organization} activeWatchlists={props.activeWatchlistCount} pausedWatchlists={props.pausedWatchlistCount} memberCount={props.activeMemberCount} inviteCount={props.pendingInviteCount} webhookCount={props.configuredDestinationCount} />
                <WorkspaceHealthStrip organization={organization} bundle={bundle} />
            </>}
            {activePage === 'settings' && <SettingsPanel settingsDraft={props.settingsDraft} setSettingsDraft={props.setSettingsDraft} settingsDirty={props.settingsDirty} canManage={canManage} busy={busy} rowMessage={props.rowMessages.settings} onSave={props.onSaveSettings} onReset={props.onResetSettings} />}
            {activePage === 'team' && canManage && <InvitePanel emails={props.inviteEmails} setEmails={props.setInviteEmails} role={props.inviteRole} setRole={props.setInviteRole} invites={bundle.invites} members={bundle.members} canManage={canManage} busy={busy} rowMessages={props.rowMessages} selectedSubject={selectedSubject} onSelectSubject={onSelectSubject} onInvite={props.onCreateInvite} onInviteAction={props.onInviteAction} onCopyInvite={props.onCopyInvite} />}
            {activePage === 'team' && <MemberPanel members={bundle.members} canManage={canManage} busy={busy} rowMessages={props.rowMessages} selectedSubject={selectedSubject} onSelectSubject={onSelectSubject} onRoleChange={props.onRoleChange} onRemove={props.onRemoveMember} />}
            {activePage === 'watchlists' && <WatchlistPanel watchlists={bundle.watchlists} activeTerms={bundle.alertTerms} members={bundle.members} canManage={canEdit} canCleanup={canManage} busy={busy} draft={props.watchlistDraft} setDraft={props.setWatchlistDraft} suggestions={props.watchlistSuggestions} editing={props.editingWatchlist} setEditing={props.setEditingWatchlist} onCreate={props.onCreateWatchlist} onSave={props.onSaveWatchlist} onAction={props.onWatchlistAction} onDelete={props.onDeleteWatchlist} organization={organization} alerts={bundle.alerts} deliveries={bundle.deliveries} onCleanup={props.onCleanupWatchlists} onRefreshAlerts={props.onRefreshAlerts} onRequestFreshCollection={props.onRequestFreshCollection} onRefreshCollectionStatus={props.onRefreshCollectionStatus} collectionRequest={props.collectionRequest} rowMessages={props.rowMessages} draftDuplicate={props.watchlistDraftDuplicate} selectedSubject={selectedSubject} onSelectSubject={onSelectSubject} />}
            {activePage === 'api-keys' && (canManage ? <EventApiKeyPanel key={organization.id} apiKeys={bundle.apiKeys} secret={props.newApiKeySecret} canManage={canManage} busy={busy} rowMessage={props.rowMessages['event-api-key']} onCreate={props.onCreateApiKey} onRevoke={props.onRevokeApiKey} onClearSecret={props.onClearApiKeySecret} /> : <p className='rounded-lg border border-ui-border bg-ui-panel p-4 text-sm text-ui-muted'>Only this organization’s owners and admins can manage API keys.</p>)}
            {activePage === 'privacy' && <PrivacyLifecyclePanel organization={organization} privacy={bundle.privacy} retentionDays={Number(bundle.settings?.retentionDays || 365)} canManage={canManage} busy={busy} rowMessage={props.rowMessages.privacy} onRun={props.onRunRetention} onExport={props.onExportPrivacy} onDelete={props.onDeletePrivacy} />}
            {activePage === 'events' && <ScopePanel alertTerms={bundle.alertTerms} alerts={bundle.alerts} cases={bundle.cases} deliveries={bundle.deliveries} members={bundle.members} watchlists={bundle.watchlists} webhooks={bundle.webhooks} alertCaseVisibility={bundle.alertCaseVisibility} organizationId={organization.id} />}
            {activePage === 'activity' && <ActivityPanel organization={organization} bundle={bundle} activity={props.activity} selectedSubject={selectedSubject} onSelectSubject={onSelectSubject} />}
        </>}
    </div>
}
