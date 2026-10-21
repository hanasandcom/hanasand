import { Panel, WorkspacePrimaryAction } from './workbenchPaneDisplay'
import { FolderGit2 } from 'lucide-react'
import ErrorNotice from '@/components/error/errorNotice'

export function WorkspaceImportPanel({ importInput, githubToken, importPending, importError, onImportInputChange, onGitHubTokenChange, onImportRepo }: { importInput: string, githubToken: string, importPending: boolean, importError: string | null, onImportInputChange: (value: string) => void, onGitHubTokenChange: (value: string) => void, onImportRepo: () => void | Promise<void> }) {
    return (<>
        <Panel
            icon={<FolderGit2 className='h-4 w-4' />}
            title='Attach repository'
            subtitle='Import a public or private repository.'
        >
            <div className='flex gap-2'>
                <input id='workspace-repository-url' value={importInput} onChange={(event) => onImportInputChange(event.target.value)} placeholder='owner/repo, URL, or repo#branch:path' className='min-w-0 flex-1 rounded-lg bg-ui-panel px-3 py-2 text-sm text-ui-text outline outline-ui-border placeholder:text-ui-muted' />
                <WorkspacePrimaryAction onClick={onImportRepo} disabled={importPending}>
                    {importPending ? 'Importing' : 'Import'}
                </WorkspacePrimaryAction>
            </div>
            <input
                value={githubToken}
                onChange={(event) => onGitHubTokenChange(event.target.value)}
                placeholder='GitHub token for private repos (optional, one-time use)'
                type='password'
                autoComplete='off'
                spellCheck={false}
                className='rounded-lg bg-ui-panel px-3 py-2 text-sm text-ui-text outline outline-ui-border placeholder:text-ui-muted'
            />
            <div className='text-xs text-ui-muted'>
                Tokens are only sent with the current import or refresh request and are cleared again after successful use.
            </div>
            {importError ? <ErrorNotice compact message={importError} /> : null}
        </Panel>

    </>)
}
