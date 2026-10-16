'use client'

import { GitBranch, RotateCcw } from 'lucide-react'
import ErrorNotice from '@/components/error/errorNotice'
import { GitChangesPanel } from './gitPlugin/GitChangesPanel'
import { GitCommitPanel } from './gitPlugin/GitCommitPanel'
import { GitSourceControls } from './gitPlugin/GitSourceControls'
import { GitSyncSummary } from './gitPlugin/GitSyncSummary'
import { formatSyncTime } from './gitPlugin/storage'
import { useGitPluginController } from './gitPlugin/useGitPluginController'
import type { GitPluginProps } from './gitPlugin/types'

export default function GitPlugin({ shareRouteId, share }: GitPluginProps) {
    const git = useGitPluginController({ shareRouteId, share })
    return (
        <section className='rounded-lg border border-ui-border bg-ui-panel p-3'>
            <div className='flex items-start gap-2'>
                <div className='grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-ui-primary/25 bg-ui-primary/10 text-ui-primary'><GitBranch className='h-4 w-4' /></div>
                <div className='min-w-0'>
                    <div className='text-xs font-semibold text-ui-text'>Git</div>
                    <div className='mt-0.5 text-[11px] leading-4 text-ui-muted'>Import or pull from GitHub, Forgejo, GitLab, or any public Git URL.</div>
                </div>
            </div>

            <div className='mt-3 grid gap-2'>
                <GitSourceControls {...git} />
                <GitSyncSummary progress={git.syncProgress} startedAt={git.syncStartedAt} languages={git.languageOverview} />
                <GitChangesPanel {...git} />
                <GitCommitPanel {...git} />
                {git.stored ? <StoredWorkspaceSummary workspace={git.stored} /> : null}
                {git.status ? <div className='text-[11px] leading-4 text-ui-success'>{git.status}</div> : null}
                {git.error ? <ErrorNotice compact message={git.error} /> : null}
            </div>
        </section>
    )
}

function StoredWorkspaceSummary({ workspace }: { workspace: NonNullable<ReturnType<typeof useGitPluginController>['stored']> }) {
    return (
        <div className='rounded-lg border border-ui-border bg-ui-raised px-2.5 py-2 text-[11px] leading-4 text-ui-muted'>
            <div className='truncate text-ui-text'>{workspace.fullName}</div>
            <div className='mt-0.5 flex items-center gap-1.5'><RotateCcw className='h-3 w-3' />{workspace.branch}{workspace.sourcePath ? ` / ${workspace.sourcePath}` : ''}</div>
            <div className='mt-1 text-ui-muted'>Last synced {formatSyncTime(workspace.lastSyncedAt || workspace.updatedAt)}</div>
        </div>
    )
}
