import Link from 'next/link'
import { GitBranch, GitPullRequestArrow, LoaderCircle, LockKeyhole } from 'lucide-react'
import { autoPullOptions } from './storage'
import type { GitPluginState } from './types'
import { GitPluginPanel } from './GitPluginPanel'

type Props = Pick<GitPluginState, 'input' | 'setInput' | 'githubToken' | 'setGitHubToken' | 'isSignedIn' | 'pending' | 'currentInput' | 'syncRepository' | 'autoPullMinutes' | 'setAutoPullMinutes'>

export function GitSourceControls({ input, setInput, githubToken, setGitHubToken, isSignedIn, pending, currentInput, syncRepository, autoPullMinutes, setAutoPullMinutes }: Props) {
    return (
        <>
            {!isSignedIn ? (
                <div className='rounded-lg border border-ui-warning/30 bg-ui-warning/10 p-2 text-[11px] leading-4 text-ui-warning'>
                    <div className='flex items-center gap-2 font-semibold'>
                        <LockKeyhole className='h-3.5 w-3.5' />
                        Sign in for Git access
                    </div>
                    <Link prefetch={false} href='/login' className='mt-2 inline-block underline-offset-4 hover:underline'>
                        Log in to pull public repositories and private GitHub repositories
                    </Link>
                </div>
            ) : null}

            <input
                value={input}
                onChange={event => setInput(event.target.value)}
                placeholder='owner/repo, GitHub URL, or public Git URL'
                spellCheck={false}
                className='min-w-0 rounded-lg border border-ui-border bg-ui-raised px-2.5 py-2 text-xs text-ui-text outline-none placeholder:text-ui-muted focus:border-ui-primary'
            />
            <input
                value={githubToken}
                onChange={event => setGitHubToken(event.target.value)}
                placeholder='GitHub token for private GitHub repos'
                type='password'
                autoComplete='off'
                spellCheck={false}
                className='min-w-0 rounded-lg border border-ui-border bg-ui-raised px-2.5 py-2 text-xs text-ui-text outline-none placeholder:text-ui-muted focus:border-ui-primary'
            />

            <div className='grid grid-cols-2 gap-2'>
                <button type='button' onClick={() => void syncRepository('import')} disabled={!isSignedIn || Boolean(pending)} className='inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-ui-primary px-2 text-xs font-semibold text-ui-on-primary transition-opacity hover:opacity-90 disabled:opacity-55'>
                    {pending === 'import' ? <LoaderCircle className='h-3.5 w-3.5 animate-spin' /> : <GitBranch className='h-3.5 w-3.5' />}
                    Load
                </button>
                <button type='button' onClick={() => void syncRepository('pull')} disabled={!isSignedIn || Boolean(pending) || !currentInput} className='inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-2 text-xs font-semibold text-ui-text transition-colors hover:border-ui-primary hover:text-ui-primary disabled:opacity-55'>
                    {pending === 'pull' ? <LoaderCircle className='h-3.5 w-3.5 animate-spin' /> : <GitPullRequestArrow className='h-3.5 w-3.5' />}
                    Pull
                </button>
            </div>

            <GitPluginPanel>
                <div className='flex items-center justify-between gap-2'>
                    <div>
                        <div className='text-[11px] font-semibold text-ui-text'>Auto pull</div>
                        <div className='text-[10px] leading-4 text-ui-muted'>{autoPullMinutes ? `Syncs remote every ${autoPullMinutes} min while this workspace is open` : 'Disabled for this workspace'}</div>
                    </div>
                    <select value={autoPullMinutes} onChange={event => setAutoPullMinutes(Number(event.target.value))} className='h-8 rounded-lg border border-ui-border bg-ui-panel px-2 text-[11px] font-semibold text-ui-text outline-none focus:border-ui-primary'>
                        {autoPullOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                </div>
            </GitPluginPanel>
        </>
    )
}
