import { ArtifactList } from './chatArtifacts'
import { X } from 'lucide-react'

export function ArtifactSidebar({ groups, onPreview, onClose }: { groups: ReturnType<typeof import('./chatArtifacts').groupArtifacts>, onPreview: (artifact: AIArtifact | null) => void, onClose: () => void }) {
    return <aside aria-label='Repository output' className='absolute inset-y-0 right-0 z-30 flex min-h-0 w-[min(22rem,100%)] min-w-0 flex-col border-l border-ui-border bg-ui-panel shadow-2xl xl:relative xl:inset-auto xl:z-auto xl:w-full xl:shadow-none'>
        <div className='flex items-center justify-between gap-3 border-b border-ui-border px-4 py-3'>
            <h2 className='text-[11px] font-semibold uppercase text-ui-muted'>Repository output</h2>
            <button type='button' onClick={onClose} aria-label='Close repository output' className='grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ui-muted transition-colors hover:bg-ui-raised hover:text-ui-text xl:hidden'><X className='h-4 w-4' /></button>
        </div>
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
