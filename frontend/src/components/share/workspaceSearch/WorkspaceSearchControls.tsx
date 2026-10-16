import { Files, Loader2, Replace, Search, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'

const inputClass = 'w-full rounded-lg border border-ui-border bg-ui-raised px-3 py-2 text-sm text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary focus:bg-ui-panel'
const iconButtonClass = 'grid h-8 w-8 place-items-center rounded-lg border border-ui-border bg-ui-raised text-ui-muted transition hover:border-ui-primary hover:text-ui-text'

type Props = {
    fileCount: number
    query: string
    replacement: string
    include: string
    exclude: string
    caseSensitive: boolean
    wholeWord: boolean
    regex: boolean
    resultCount: number
    groupCount: number
    loading: boolean
    replacing: boolean
    onQueryChange: (value: string) => void
    onReplacementChange: (value: string) => void
    onIncludeChange: (value: string) => void
    onExcludeChange: (value: string) => void
    onToggleCaseSensitive: () => void
    onToggleWholeWord: () => void
    onToggleRegex: () => void
    onReplaceAll: () => void
}

export function WorkspaceSearchControls(props: Props) {
    return <>
        <header className='flex items-center justify-between border-b border-ui-border px-3 py-3'>
            <div>
                <p className='text-[11px] font-semibold uppercase tracking-[0.22em] text-ui-muted'>Search</p>
                <h2 className='text-sm font-semibold text-ui-text'>Workspace search</h2>
            </div>
            <div className='flex items-center gap-1'>
                <Sparkles className='h-4 w-4 text-ui-primary' />
                <span className='rounded-full border border-ui-border bg-ui-raised px-2 py-1 text-[11px] text-ui-muted'>{props.fileCount} files</span>
            </div>
        </header>
        <div className='space-y-2 border-b border-ui-border p-3'>
            <SearchInput
                value={props.query}
                onChange={props.onQueryChange}
                label='Search files'
                placeholder='Search files'
                icon={<Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ui-muted' />}
            />
            <SearchInput
                value={props.replacement}
                onChange={props.onReplacementChange}
                label='Replace text'
                placeholder='Replace'
                icon={<Replace className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ui-muted' />}
            />
            <div className='grid grid-cols-2 gap-2'>
                <input
                    aria-label='Files to include'
                    value={props.include}
                    onChange={event => props.onIncludeChange(event.target.value)}
                    placeholder='files to include'
                    className={inputClass}
                />
                <input
                    aria-label='Files to exclude'
                    value={props.exclude}
                    onChange={event => props.onExcludeChange(event.target.value)}
                    placeholder='files to exclude'
                    className={inputClass}
                />
            </div>
            <div className='flex items-center justify-between gap-2'>
                <div className='flex items-center gap-1'>
                    <Toggle active={props.caseSensitive} onClick={props.onToggleCaseSensitive} label='Aa' title='Match case' />
                    <Toggle active={props.wholeWord} onClick={props.onToggleWholeWord} label='ab' title='Whole word' />
                    <Toggle active={props.regex} onClick={props.onToggleRegex} label='.*' title='Regular expression' />
                </div>
                <button
                    type='button'
                    disabled={!props.resultCount || props.replacing}
                    onClick={props.onReplaceAll}
                    className='inline-flex items-center gap-2 rounded-lg border border-ui-primary bg-ui-primary/10 px-3 py-2 text-xs font-semibold text-ui-primary transition hover:bg-ui-primary/20 disabled:cursor-not-allowed disabled:opacity-40'
                >
                    {props.replacing ? <Loader2 className='h-3.5 w-3.5 animate-spin' /> : <Replace className='h-3.5 w-3.5' />}
                    Replace all
                </button>
            </div>
        </div>
        <div className='flex items-center justify-between border-b border-ui-border px-3 py-2 text-xs text-ui-muted'>
            <span>
                {props.loading ? 'Indexing workspace...' : `${props.resultCount} results in ${props.groupCount} files`}
            </span>
            {props.loading ? <Loader2 className='h-4 w-4 animate-spin text-ui-loader' /> : <Files className='h-4 w-4' />}
        </div>
    </>
}

function SearchInput({ value, onChange, label, placeholder, icon }: {
    value: string
    onChange: (value: string) => void
    label: string
    placeholder: string
    icon: ReactNode
}) {
    return <div className='relative'>
        {icon}
        <input
            aria-label={label}
            value={value}
            onChange={event => onChange(event.target.value)}
            placeholder={placeholder}
            className={`${inputClass} pl-9`}
        />
    </div>
}

function Toggle({ active, onClick, label, title }: { active: boolean, onClick: () => void, label: string, title: string }) {
    return (
        <button
            type='button'
            title={title}
            onClick={onClick}
            className={`${iconButtonClass} ${active ? 'border-ui-primary bg-ui-primary/15 text-ui-primary' : ''}`}
        >
            <span className='text-xs font-bold'>{label}</span>
        </button>
    )
}
