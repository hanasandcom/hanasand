import { ArtifactList } from './chatArtifacts'

export function ArtifactSidebar({ groups, onPreview }: { groups: ReturnType<typeof import('./chatArtifacts').groupArtifacts>, onPreview: (artifact: AIArtifact | null) => void }) {
    return <aside className='min-h-0 border-t border-ui-border bg-ui-panel xl:border-t-0 xl:border-l'>
        <div className='border-b border-ui-border px-4 py-3 text-[11px] font-semibold uppercase text-ui-muted'>Workspace output</div>
        <div className='min-h-0 space-y-3 overflow-y-auto p-4'>
            {groups.map(group => <section key={group.kind} className='space-y-3'>
                <div className='flex items-center justify-between gap-3'>
                    <div><div className='text-[10px] font-semibold uppercase text-ui-muted'>{group.label}</div><div className='mt-1 text-xs text-ui-muted'>{group.artifacts.length} item{group.artifacts.length === 1 ? '' : 's'}</div></div>
                    <div className='rounded-full border border-ui-border px-2.5 py-1 text-[10px] font-semibold uppercase text-ui-muted'>{group.kind}</div>
                </div>
                <ArtifactList artifacts={group.artifacts} forceExpanded onPreview={onPreview} />
            </section>)}
        </div>
    </aside>
}
