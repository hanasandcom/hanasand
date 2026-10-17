import { Panel, Stat, formatActivityTime, formatUsageKind } from './workbenchPaneDisplay'
import { RefreshCcw, Share2, TerminalSquare } from 'lucide-react'

export function WorkspaceOverviewPanels({ activeConversation, activeRepo, activeShare, workspaceSource, selectedPath, lastWorkspaceAction, lastWorkspaceActionAt, lastChangedPath, recentPaths, ownershipSummary }: { activeConversation: AIConversation | null, activeRepo: AIImportedRepo | null, activeShare: Share | null, workspaceSource: string | null, selectedPath: string | null, lastWorkspaceAction: string | null, lastWorkspaceActionAt: string | null, lastChangedPath: string | null, recentPaths: string[], ownershipSummary: AIOwnershipSummary | null }) {
    return (<>
        <Panel
            icon={<TerminalSquare className='h-4 w-4' />}
            title='Workspace'
            subtitle={activeRepo?.fullName || activeShare?.alias || activeShare?.path || 'No workspace attached'}
        >
            <Stat label='Mode' value={activeConversation?.workspaceKind === 'repo' ? 'Repository' : activeConversation?.workspaceKind === 'share' ? 'Share' : 'Idle'} />
            <Stat label='Source' value={workspaceSource === 'scaffold' ? 'Scaffolded starter' : workspaceSource === 'repository-sync' ? 'Repository mirror' : workspaceSource === 'share' ? 'Existing share' : 'Unknown'} />
            <Stat label='Focus' value={selectedPath || 'No file selected'} />
            <Stat label='Shares' value={`${activeConversation?.shareIds?.length || 0} attached`} />
            {activeRepo ? <Stat label='Stack' value={activeRepo.stackType === 'unknown' ? (activeRepo.stackReason || 'Unsupported stack') : activeRepo.stackType.replaceAll('_', ' ')} /> : null}
        </Panel>

        {lastWorkspaceAction ? (
            <Panel
                icon={<RefreshCcw className='h-4 w-4' />}
                title='Recent workspace activity'
                subtitle={lastWorkspaceAction}
            >
                <Stat label='Latest' value={lastChangedPath || 'Workspace-level change'} />
                <Stat label='When' value={formatActivityTime(lastWorkspaceActionAt)} />
                <Stat label='Tracked files' value={recentPaths.length ? `${recentPaths.length} recent path${recentPaths.length === 1 ? '' : 's'}` : 'No recent files'} />
            </Panel>
        ) : null}

        {ownershipSummary ? (
            <Panel
                icon={<Share2 className='h-4 w-4' />}
                title='Ownership and usage'
                subtitle='Workspace owners, seats, and recent usage.'
            >
                <Stat label='Owners' value={ownershipSummary.ownerIds.join(', ') || 'Unknown'} />
                <Stat label='Repo owners' value={ownershipSummary.repositoryOwnerIds.join(', ') || 'None'} />
                <Stat label='Preview owners' value={ownershipSummary.vmOwnerIds.join(', ') || 'None'} />
                <Stat label='Owned sessions' value={String(ownershipSummary.ownedConversationCount)} />
                <Stat label='Shared sessions' value={String(ownershipSummary.sharedConversationCount)} />
                <Stat label='Seats' value={`${ownershipSummary.collaboratorSeatCount} invited`} />
                <Stat label='Repos / launches' value={`${ownershipSummary.repositoryCount} repos · ${ownershipSummary.deploymentCount} launches`} />
                <Stat label='External repos' value={String(ownershipSummary.externalRepositoryCount)} />
                <Stat label='External previews' value={String(ownershipSummary.externalVmCount)} />
                <Stat label='24h usage' value={`${ownershipSummary.usageEventCount24h} events · ${ownershipSummary.usageUnitCount24h} units`} />
                <Stat label='Active users' value={`${ownershipSummary.activeActorCount24h} seen in the last day`} />
                {ownershipSummary.boundaryWarnings.length ? (
                    <div className='space-y-1'>
                        {ownershipSummary.boundaryWarnings.map((warning) => (
                            <div key={warning} className='rounded-lg bg-ui-warning/8 px-3 py-2 text-xs text-ui-warning outline outline-ui-warning/40'>
                                {warning}
                            </div>
                        ))}
                    </div>
                ) : null}
                {ownershipSummary.recentUsage.length ? (
                    <div className='space-y-1'>
                        {ownershipSummary.recentUsage.slice(0, 4).map((event) => (
                            <div key={`${event.kind}-${event.createdAt}-${event.actorId || 'system'}`} className='rounded-lg bg-ui-raised px-3 py-2 text-xs text-ui-muted outline outline-ui-border'>
                                <div className='flex items-center justify-between gap-3'>
                                    <span className='truncate font-medium text-ui-text'>{formatUsageKind(event.kind)}</span>
                                    <span className='shrink-0 text-[10px] uppercase tracking-[0.14em] text-ui-muted'>{formatActivityTime(event.createdAt)}</span>
                                </div>
                                <div className='mt-1 truncate text-[11px] text-ui-muted'>
                                    {event.actorName || event.actorId || 'System'} {'->'} {event.ownerName || event.ownerId}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : null}
            </Panel>
        ) : null}



    </>)
}


export function WorkspaceAccessSummary({ activeConversation, launchOwners, reportOwners, ownershipSummary, latestRelease }: { activeConversation: AIConversation | null, launchOwners: string[], reportOwners: string[], ownershipSummary: AIOwnershipSummary | null, latestRelease: AIRelease | null }) {
    return <>{            <Panel
        icon={<Share2 className='h-4 w-4' />}
        title='Access summary'
        subtitle='Session and preview details.'
    >
        <Stat label='Tenant owner' value={activeConversation?.ownerId || 'Unknown'} />
        <Stat label='Your role' value={activeConversation?.collaboration?.role || 'owner'} />
        <Stat label='Launch owners' value={launchOwners.length ? String(launchOwners.length) : 'None yet'} />
        <Stat label='Report owners' value={reportOwners.length ? String(reportOwners.length) : 'None yet'} />
        <Stat label='Repo boundary' value={ownershipSummary ? `${ownershipSummary.externalRepositoryCount} external` : 'Unknown'} />
        <Stat label='Preview boundary' value={ownershipSummary ? `${ownershipSummary.externalVmCount} external` : 'Unknown'} />
        <div className='rounded-lg bg-ui-raised px-3 py-2 text-xs text-ui-muted outline outline-ui-border'>
            Latest preview: {latestRelease ? `${latestRelease.accessPolicy.replaceAll('_', ' ')} via ${latestRelease.vmName}` : 'No report details yet'}
        </div>
        <div className='text-xs text-ui-muted'>
            Repository, preview, launch, and report ownership are checked against the active workspace owner.
        </div>
    </Panel>}</>
}
