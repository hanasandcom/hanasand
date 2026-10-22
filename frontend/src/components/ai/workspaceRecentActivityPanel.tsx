import { Panel, Stat, formatActivityTime } from './workbenchPaneDisplay'
import { RefreshCcw } from 'lucide-react'

export function WorkspaceRecentActivityPanel({ lastWorkspaceAction, lastWorkspaceActionAt, lastChangedPath, recentPaths }: { lastWorkspaceAction: string | null, lastWorkspaceActionAt: string | null, lastChangedPath: string | null, recentPaths: string[] }) {
    if (!lastWorkspaceAction) return null
    return (
        <Panel
            icon={<RefreshCcw className='h-4 w-4' />}
            title='Recent repository activity'
            subtitle={lastWorkspaceAction}
        >
            <Stat label='Latest' value={lastChangedPath || 'Repository-level change'} />
            <Stat label='When' value={formatActivityTime(lastWorkspaceActionAt)} />
            <Stat label='Tracked files' value={recentPaths.length ? `${recentPaths.length} recent path${recentPaths.length === 1 ? '' : 's'}` : 'No recent files'} />
        </Panel>
    )
}
