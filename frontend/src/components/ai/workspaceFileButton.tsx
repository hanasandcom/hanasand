import { PathBadge } from './workbenchPaneDisplay'

type WorkspaceFileButtonProps = Parameters<typeof PathBadge>[0] & {
    onSelect: (path: string) => void | Promise<void>
}

export function WorkspaceFileButton(props: WorkspaceFileButtonProps) {
    const { path, selected, recentPaths, lastChangedPath, onSelect } = props
    return (
        <button
            type='button'
            onClick={() => void onSelect(path)}
            className={`block w-full rounded-lg px-2 py-1.5 text-left text-xs outline ${selected
                ? 'bg-ui-primary/12 text-ui-on-primary outline-ui-primary/18'
                : 'bg-ui-raised text-ui-muted outline-transparent hover:outline-ui-border'}`}
        >
            <div className='flex items-center justify-between gap-3'>
                <span className='truncate'>{path}</span>
                <PathBadge {...{ path, selected, recentPaths, lastChangedPath }} />
            </div>
        </button>
    )
}
