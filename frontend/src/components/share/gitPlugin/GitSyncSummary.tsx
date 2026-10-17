import { Clock3 } from 'lucide-react'
import { formatEta } from './storage'
import type { LanguageStat } from './types'
import { GitPluginPanel } from './GitPluginPanel'

type Props = { progress: AISyncProgress | null, startedAt: number | null, languages: LanguageStat[] }

export function GitSyncSummary({ progress, startedAt, languages }: Props) {
    if (!progress && !languages.length) return null
    return (
        <GitPluginPanel>
            {progress ? <SyncProgressMeter progress={progress} startedAt={startedAt} /> : null}
            {languages.length ? <LanguageOverview stats={languages} /> : null}
        </GitPluginPanel>
    )
}

function SyncProgressMeter({ progress, startedAt }: { progress: AISyncProgress, startedAt: number | null }) {
    const percentage = progress.totalFiles > 0 ? Math.round((progress.syncedFiles / progress.totalFiles) * 100) : 0
    return (
        <div>
            <div className='flex items-center justify-between gap-2 text-[11px] font-semibold text-ui-text'>
                <span>Sync progress</span><span>{progress.syncedFiles}/{progress.totalFiles} files</span>
            </div>
            <div className='mt-2 h-2 overflow-hidden rounded-full border border-ui-border bg-ui-panel'>
                <div className='h-full rounded-full bg-ui-primary' style={{ width: `${percentage}%` }} />
            </div>
            <div className='mt-1.5 flex items-center justify-between gap-2 text-[10px] leading-4 text-ui-muted'>
                <span className='min-w-0 truncate'>{progress.currentPath || 'Preparing files...'}</span>
                <span className='inline-flex shrink-0 items-center gap-1'><Clock3 className='h-3 w-3' />{formatEta(progress, startedAt)}</span>
            </div>
        </div>
    )
}

function LanguageOverview({ stats }: { stats: LanguageStat[] }) {
    return (
        <div className='mt-3'>
            <div className='text-[11px] font-semibold text-ui-text'>Language overview</div>
            <div className='mt-2 space-y-1.5'>
                {stats.map(stat => (
                    <div key={stat.language}>
                        <div className='mb-1 flex items-center justify-between text-[10px] text-ui-muted'>
                            <span>{stat.language}</span><span>{stat.percentage}% · {stat.files} file{stat.files === 1 ? '' : 's'}</span>
                        </div>
                        <div className='h-1.5 overflow-hidden rounded-full bg-ui-panel'>
                            <div className='h-full rounded-full bg-ui-muted' style={{ width: `${stat.percentage}%` }} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
