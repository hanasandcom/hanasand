export default function SelectedWatchTerms({ terms, previewCount }: { terms: string[], previewCount: number }) {
    const visibleTerms = terms.slice(0, previewCount)
    return (
        <div className='mt-2 flex min-w-0 flex-wrap gap-1.5'>
            {visibleTerms.map(term => (
                <span key={term} className='max-w-full wrap-break-word rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-[11px] font-semibold text-ui-text dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>{term}</span>
            ))}
            {!terms.length ? <span className='text-[11px] text-ui-muted dark:text-ui-muted'>Add watch term.</span> : null}
        </div>
    )
}
