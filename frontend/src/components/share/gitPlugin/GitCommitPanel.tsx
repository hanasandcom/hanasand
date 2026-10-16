import { GitCommitHorizontal, GitPullRequestArrow, LoaderCircle, SendHorizontal } from 'lucide-react'
import type { GitPluginState } from './types'

type Props = Pick<GitPluginState, 'isSignedIn' | 'pending' | 'pullGitWorkspace' | 'commitSelectedFiles' | 'pushGitWorkspace' | 'selectedPaths' | 'commitMessage' | 'setCommitMessage'>

export function GitCommitPanel({ isSignedIn, pending, pullGitWorkspace, commitSelectedFiles, pushGitWorkspace, selectedPaths, commitMessage, setCommitMessage }: Props) {
    return (
        <div className='rounded-lg border border-ui-border bg-ui-raised p-2.5'>
            <div className='text-[11px] font-semibold text-ui-text'>Commit and push</div>
            <input value={commitMessage} onChange={event => setCommitMessage(event.target.value)} placeholder='Commit message' className='mt-2 min-w-0 rounded-lg border border-ui-border bg-ui-panel px-2.5 py-2 text-xs text-ui-text outline-none placeholder:text-ui-muted focus:border-ui-primary' />
            <div className='mt-2 grid grid-cols-3 gap-2'>
                <button type='button' onClick={() => void pullGitWorkspace()} disabled={!isSignedIn || Boolean(pending)} className='inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-ui-border bg-ui-panel px-2 text-[11px] font-semibold text-ui-text transition-colors hover:border-ui-primary hover:text-ui-primary disabled:opacity-55'>
                    {pending === 'pull' ? <LoaderCircle className='h-3.5 w-3.5 animate-spin' /> : <GitPullRequestArrow className='h-3.5 w-3.5' />}
                    Pull
                </button>
                <button type='button' onClick={() => void commitSelectedFiles()} disabled={!isSignedIn || Boolean(pending) || !selectedPaths.size || !commitMessage.trim()} className='inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-ui-border bg-ui-panel px-2 text-[11px] font-semibold text-ui-text transition-colors hover:border-ui-primary hover:text-ui-primary disabled:opacity-55'>
                    {pending === 'commit' ? <LoaderCircle className='h-3.5 w-3.5 animate-spin' /> : <GitCommitHorizontal className='h-3.5 w-3.5' />}
                    Commit
                </button>
                <button type='button' onClick={() => void pushGitWorkspace()} disabled={!isSignedIn || Boolean(pending)} className='inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-ui-primary px-2 text-[11px] font-semibold text-ui-on-primary transition-opacity hover:opacity-90 disabled:opacity-55'>
                    {pending === 'push' ? <LoaderCircle className='h-3.5 w-3.5 animate-spin' /> : <SendHorizontal className='h-3.5 w-3.5' />}
                    Push
                </button>
            </div>
        </div>
    )
}
