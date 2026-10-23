import { Check, Plus, Trash2 } from 'lucide-react'
import Link from 'next/link'
import type { SandboxProfile } from '../types'
import { defaultProfiles } from '../browserSetup'

export function ProfileToolEditor({
    profile,
    locked,
    toolName,
    toolUrl,
    onToolName,
    onToolUrl,
    onAddTool,
    onRemoveTool,
}: {
    profile: SandboxProfile
    locked: boolean
    toolName: string
    toolUrl: string
    onToolName: (value: string) => void
    onToolUrl: (value: string) => void
    onAddTool: () => void
    onRemoveTool: (id: string) => void
}) {
    return (
        <div className='grid gap-3 rounded-md border border-ui-border bg-ui-raised p-3'>
            <div className='flex flex-wrap items-center justify-between gap-2'>
                <div>
                    <p className='text-sm font-semibold text-ui-text'>{profile.name}</p>
                    <p className='mt-1 text-xs text-ui-muted'>{profile.tools.length ? `${profile.tools.length} tool${profile.tools.length === 1 ? '' : 's'} open on every run.` : 'Browser-only profile.'}</p>
                </div>
                {locked ? <span className='rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-xs font-semibold text-ui-muted'>built in</span> : null}
            </div>
            <div className='grid gap-2'>
                {profile.tools.map(tool => (
                    <div key={tool.id} className='grid gap-2 rounded-md border border-ui-border bg-ui-panel p-2 text-sm md:grid-cols-[8rem_minmax(0,1fr)_auto]'>
                        <span className='font-semibold text-ui-text'>{tool.name}</span>
                        <span className='min-w-0 truncate font-mono text-xs text-ui-muted'>{tool.url}</span>
                        {!locked ? (
                            <button type='button' onClick={() => onRemoveTool(tool.id)} className='grid h-8 w-8 place-items-center rounded-md border border-ui-border text-ui-muted hover:text-ui-text' aria-label={`Remove ${tool.name}`}>
                                <Trash2 className='h-3.5 w-3.5' />
                            </button>
                        ) : null}
                    </div>
                ))}
            </div>
            {!locked ? (
                <div className='grid gap-2 md:grid-cols-[12rem_minmax(0,1fr)_auto]'>
                    <input value={toolName} onChange={event => onToolName(event.target.value)} placeholder='Tool name' className='h-9 rounded-md border border-ui-border bg-ui-canvas px-3 text-sm text-ui-text outline-none' />
                    <input value={toolUrl} onChange={event => onToolUrl(event.target.value)} placeholder='https://tool.example/search?q={url}' className='h-9 min-w-0 rounded-md border border-ui-border bg-ui-canvas px-3 font-mono text-xs text-ui-text outline-none' />
                    <button type='button' onClick={onAddTool} className='inline-flex h-9 items-center justify-center gap-2 rounded-md border border-ui-border px-3 text-sm font-semibold text-ui-text transition hover:border-ui-primary'>
                        <Plus className='h-4 w-4' />
                        Add
                    </button>
                </div>
            ) : null}
        </div>
    )
}

export function ProfilePicker({ paid, profiles, selectedProfileId, onSelect, onDelete }: { paid: boolean; profiles: SandboxProfile[]; selectedProfileId: string; onSelect: (id: string) => void; onDelete: (id: string) => void }) {
    return (
        <div className='flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1'>
            {profiles.map(profile => {
                const selected = selectedProfileId === profile.id
                const locked = defaultProfiles.some(item => item.id === profile.id)
                if (!paid && !defaultProfiles.some(item => item.id === profile.id)) return <Link key={profile.id} href='/pricing#browser' className='inline-flex min-h-9 shrink-0 items-center gap-2 rounded-md border border-ui-border px-3 text-sm font-semibold text-ui-primary'>{profile.name} · Upgrade</Link>
                return (
                    <span key={profile.id} className={`inline-flex min-h-9 shrink-0 items-center overflow-hidden rounded-md border transition ${selected ? 'border-ui-primary bg-ui-primary/10 text-ui-primary' : 'border-ui-border bg-ui-panel text-ui-text'}`}>
                        <button
                            type='button'
                            onClick={() => onSelect(profile.id)}
                            className='inline-flex min-h-9 items-center gap-2 px-3 text-sm font-semibold leading-none transition hover:bg-ui-primary/5'
                        >
                            {selected ? <Check className='h-4 w-4' /> : null}
                            <span>{profile.name}</span>
                            <span className='inline-flex items-center self-center text-xs leading-none text-ui-muted'>{profile.tools.length} tools</span>
                        </button>
                        {!locked ? (
                            <button
                                type='button'
                                onClick={() => onDelete(profile.id)}
                                className='grid h-9 w-8 place-items-center border-l border-ui-border text-ui-muted hover:text-ui-text'
                                aria-label={`Delete ${profile.name}`}
                            >
                                <Trash2 className='h-3.5 w-3.5' />
                            </button>
                        ) : null}
                    </span>
                )
            })}
        </div>
    )
}
