import { Check, LoaderCircle, RotateCcw } from 'lucide-react'
import type { GitPluginState } from './types'

type Props = Pick<GitPluginState, 'isSignedIn' | 'pending' | 'loadGitStatus' | 'gitStatus' | 'selectedPaths' | 'stageAll' | 'togglePath' | 'stored'>

export function GitChangesPanel({ isSignedIn, pending, loadGitStatus, gitStatus, selectedPaths, stageAll, togglePath, stored }: Props) {
    return (
        <div className='rounded-lg border border-ui-border bg-ui-raised p-2.5'>
            <div className='flex items-center justify-between gap-2'>
                <div className='min-w-0'>
                    <div className='text-[11px] font-semibold text-ui-text'>Changes</div>
                    <div className='truncate text-[10px] leading-4 text-ui-muted'>{gitStatus?.branchSummary || stored?.branch || 'No status loaded'}</div>
                </div>
                <button type='button' onClick={() => void loadGitStatus()} disabled={!isSignedIn || Boolean(pending)} className='inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-ui-border bg-ui-panel px-2 text-[11px] font-semibold text-ui-text transition-colors hover:border-ui-primary hover:text-ui-primary disabled:opacity-55'>
                    {pending === 'status' ? <LoaderCircle className='h-3.5 w-3.5 animate-spin' /> : <RotateCcw className='h-3.5 w-3.5' />}
                    Status
                </button>
            </div>

            {gitStatus?.files.length ? (
                <div className='mt-2 space-y-1.5'>
                    <div className='flex items-center justify-between text-[10px] text-ui-muted'>
                        <button type='button' onClick={stageAll} className='font-semibold text-ui-primary hover:underline'>Stage all</button>
                        <span>{selectedPaths.size}/{gitStatus.files.length} staged</span>
                    </div>
                    <div className='max-h-40 space-y-1 overflow-y-auto pr-1'>
                        {gitStatus.files.map(file => {
                            const selected = selectedPaths.has(file.path)
                            return (
                                <button key={file.path} type='button' onClick={() => togglePath(file.path)} className='flex min-h-8 w-full items-center gap-2 rounded-lg border border-ui-border bg-ui-panel px-2 text-left text-[11px] text-ui-muted transition-colors hover:border-ui-primary hover:text-ui-text'>
                                    <span className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${selected ? 'border-ui-primary bg-ui-primary text-ui-on-primary' : 'border-ui-border'}`}>
                                        {selected ? <Check className='h-3 w-3' /> : null}
                                    </span>
                                    <span className='shrink-0 font-mono text-[10px] text-ui-muted'>{file.index}{file.workingTree}</span>
                                    <span className='min-w-0 truncate'>{file.path}</span>
                                </button>
                            )
                        })}
                    </div>
                </div>
            ) : gitStatus ? (
                <div className='mt-2 rounded-lg border border-ui-border bg-ui-panel px-2 py-2 text-[11px] text-ui-muted'>No changed files.</div>
            ) : null}
        </div>
    )
}
