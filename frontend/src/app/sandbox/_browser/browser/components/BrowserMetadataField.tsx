type BrowserMetadataFieldProps = { label: string; value: string; onChange: (value: string) => void; ariaLabel?: string; inputMode?: 'numeric' }

export function BrowserMetadataField({ label, value, onChange, ariaLabel = label, inputMode }: BrowserMetadataFieldProps) {
    return <label className='flex h-10 items-center gap-2 rounded-md border border-ui-border bg-ui-canvas px-3 text-sm focus-within:border-ui-primary'>
        <span className='shrink-0 text-xs font-semibold uppercase text-ui-muted'>{label}</span>
        <input value={value} onChange={event => onChange(event.target.value)} inputMode={inputMode} aria-label={ariaLabel} className='min-w-0 flex-1 bg-transparent text-ui-text outline-none' />
    </label>
}
