'use client'

import type { Capture } from '../types'

export function CaptureTimeline({ captures: allCaptures }: { captures: Capture[] }) {
    const captures = allCaptures.filter(capture => capture.kind === 'page' && capture.image)
    return (
        <section className='min-h-0 overflow-hidden rounded-lg border border-ui-border bg-ui-panel'>
            <div className='flex items-center justify-between border-b border-ui-border px-4 py-3'>
                <h2 className='text-sm font-semibold text-ui-primary'>Screenshots</h2>
                <span className='text-xs text-ui-muted'>{captures.length}</span>
            </div>
            <div className='grid gap-3 p-3' data-screenshot-list>
                {captures.length ? captures.map(capture => (
                    <article key={capture.id} className='grid gap-2 rounded-md border border-ui-border bg-ui-raised p-3'>
                        <div className='flex items-start justify-between gap-3'>
                            <div className='min-w-0'>
                                <p className='text-sm font-semibold text-ui-text'>{capture.reason === 'domcontentloaded' ? 'Screenshot' : capture.label}</p>
                                <p className='mt-1 truncate font-mono text-xs text-ui-muted'>{capture.url || providerErrorText(capture.error)}</p>
                            </div>
                            <span className='rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-xs font-semibold text-ui-muted'>{capture.kind}</span>
                        </div>
                        {capture.image ? <img src={capture.image} alt={`${capture.label} screenshot`} className='max-h-64 w-full rounded border border-ui-border object-contain' /> : null}
                        {capture.frameQuality ? <p className={`text-[11px] font-semibold ${capture.frameQuality.looksBlank ? 'text-ui-text' : 'text-ui-success'}`}>{capture.frameQuality.looksBlank ? 'Blank-looking frame' : 'Rendered frame'} · {capture.frameQuality.visibleTextLength || 0} chars · {capture.frameQuality.elementCount || 0} elements</p> : null}
                        <SourceCodeDisclosure evidence={capture.evidence} />
                        {cleanEvidenceExcerpt(capture.evidence?.textExcerpt) ? <p className='line-clamp-3 text-xs leading-5 text-ui-muted'>{cleanEvidenceExcerpt(capture.evidence?.textExcerpt)}</p> : null}
                        {meaningfulReasons(capture.evidence?.reasons).length ? (
                            <div className='flex flex-wrap gap-1'>
                                {meaningfulReasons(capture.evidence?.reasons).slice(0, 4).map(reason => <span key={reason} className='rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-[11px] font-semibold text-ui-muted'>{reason}</span>)}
                            </div>
                        ) : null}
                        <p className='text-xs text-ui-muted'>{capture.capturedAt}{capture.title ? ` · ${capture.title}` : ''}</p>
                    </article>
                )) : (
                    <div className='rounded-md border border-dashed border-ui-border p-6 text-center text-sm text-ui-muted'>No captures yet.</div>
                )}
            </div>
        </section>
    )
}
