'use client'

import type { Capture } from '../types'
import { Clipboard } from 'lucide-react'
import { buildAnalystSummary } from '../browserAnalystSummary'
import { cleanEvidenceExcerpt } from '../browserBrief'
import { metadataRows } from './AnalystMetadata'

export function AnalystSummary({ summary, captures }: { summary: ReturnType<typeof buildAnalystSummary>; captures: Capture[] }) {
    const metadataItems = metadataRows(summary, captures)
    return (
        <section className='min-w-0 overflow-hidden rounded-lg border border-ui-border bg-ui-panel p-4'>
            <div className='flex items-start justify-between gap-3'>
                <div className='min-w-0'>
                    <h2 className='text-sm font-semibold text-ui-primary'>Summary</h2>
                    <p className='mt-2 wrap-break-word text-sm leading-6 text-ui-text'>{summary.narrative}</p>
                </div>
                <button
                    type='button'
                    onClick={() => void navigator.clipboard?.writeText(summary.indicators.join('\n'))}
                    className='grid h-8 w-8 shrink-0 place-items-center rounded-md border border-ui-border text-ui-text transition hover:border-ui-primary'
                    aria-label='Copy indicators'
                >
                    <Clipboard className='h-4 w-4' />
                </button>
            </div>
            <div className='mt-3 rounded-md border border-ui-border bg-ui-raised p-3'>
                <div className='flex flex-wrap items-start justify-between gap-3'>
                    <div>
                        <h3 className='mt-1 text-base font-semibold text-ui-text'>{summary.brief.verdict}</h3>
                    </div>
                </div>
                <div className='mt-3 grid gap-2 md:grid-cols-2'>
                    <div className='rounded-md border border-ui-border bg-ui-panel p-2'>
                        <p className='text-[11px] font-semibold uppercase text-ui-muted'>Impact</p>
                        <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-text'>{summary.brief.impact}</p>
                    </div>
                    {summary.brief.recommendedAction ? <div className='rounded-md border border-ui-border bg-ui-panel p-2'>
                        <p className='text-[11px] font-semibold uppercase text-ui-muted'>Recommended action</p>
                        <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-text'>{summary.brief.recommendedAction}</p>
                    </div> : null}
                    {summary.brief.nextSteps.length ? <div className='rounded-md border border-ui-border bg-ui-panel p-2'>
                        <p className='text-[11px] font-semibold uppercase text-ui-muted'>Next steps</p>
                        <ul className='mt-1 grid gap-1 wrap-break-word text-xs leading-5 text-ui-text'>
                            {summary.brief.nextSteps.map(step => <li key={step}>{step}</li>)}
                        </ul>
                    </div> : null}
                </div>
            </div>
            <div className='mt-3 grid gap-2 text-sm'>
                {metadataItems.map(row => (
                    <details key={row.label} className='group rounded-md border border-ui-border bg-ui-raised'>
                        <summary className='flex min-w-0 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 [&::-webkit-details-marker]:hidden'>
                            <span className='text-ui-muted'>{row.label}</span>
                            <span className='min-w-0 wrap-break-word text-right font-semibold text-ui-text'>{row.value}</span>
                        </summary>
                        <div className='grid gap-2 border-t border-ui-border p-3 text-xs text-ui-muted'>
                            {row.details.map(detail => <p key={detail} className='wrap-break-word leading-5'>{detail}</p>)}
                            {row.captures.slice(0, 3).map(capture => (
                                <div key={capture.id} className='grid gap-2 rounded-md border border-ui-border bg-ui-panel p-2'>
                                    <p className='truncate font-mono text-ui-text'>{capture.url}</p>
                                    {cleanEvidenceExcerpt(capture.evidence?.textExcerpt) ? <p className='line-clamp-3 leading-5'>{cleanEvidenceExcerpt(capture.evidence?.textExcerpt)}</p> : null}
                                    {capture.image ? <img src={capture.image} alt={`${capture.label} screenshot`} className='max-h-44 w-full rounded border border-ui-border object-contain' /> : null}
                                </div>
                            ))}
                        </div>
                    </details>
                ))}
            </div>
            {summary.indicators.length ? (
                <pre className='mt-3 max-h-32 overflow-auto rounded-md border border-ui-border bg-ui-canvas p-3 text-xs text-ui-text'>{summary.indicators.join('\n')}</pre>
            ) : null}
            {summary.threatAssociations.length ? (
                <div className='mt-3 rounded-md border border-ui-border bg-ui-raised p-3'>
                    <p className='text-xs font-semibold uppercase text-ui-primary'>Threat context</p>
                    <div className='mt-2 grid gap-2'>
                        {summary.threatAssociations.slice(0, 6).map(item => (
                            <div key={`${item.name}-${item.source}`} className='grid gap-1 rounded-md border border-ui-border bg-ui-panel p-2 text-xs'>
                                <div className='flex flex-wrap items-center gap-2'>
                                    <span className='font-semibold text-ui-text'>{item.name}</span>
                                    <span className='rounded border border-ui-border px-1.5 py-0.5 text-[10px] uppercase text-ui-muted'>{item.category || 'context'}</span>
                                    <span className='text-ui-muted'>{item.confidence || 'low'} confidence · {item.source?.replace(/_/g, ' ') || 'evidence'}</span>
                                </div>
                                {item.evidence ? <p className='line-clamp-2 text-ui-muted'>{item.evidence}</p> : null}
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}
            {summary.urlTimeline.length ? (
                <div className='mt-3 rounded-md border border-ui-border bg-ui-raised p-3'>
                    <p className='text-xs font-semibold uppercase text-ui-primary'>URL timeline</p>
                    <div className='mt-2 grid gap-1 text-xs text-ui-muted'>
                        {summary.urlTimeline.slice(0, 8).map(item => (
                            <div key={`${item.capturedAt}-${item.url}`} className='grid gap-1 rounded-md border border-ui-border bg-ui-panel p-2'>
                                <span>{item.capturedAt}{item.reason ? ` · ${item.reason}` : ''}</span>
                                <span className='truncate font-mono text-ui-text'>{item.url}</span>
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}
            {summary.deobfuscationTasks.length ? (
                <div className='mt-3 rounded-md border border-ui-warning/30 bg-ui-warning/10 p-3'>
                    <p className='text-xs font-semibold uppercase text-ui-warning'>WebCrack analysis</p>
                    <p className='mt-1 text-xs leading-5 text-ui-muted'>{summary.deobfuscationTasks.length} obfuscated code item{summary.deobfuscationTasks.length === 1 ? '' : 's'} extracted. {summary.webcrackLoaded ? `WebCrack loaded ${summary.webcrackLoaded} item${summary.webcrackLoaded === 1 ? '' : 's'} for deobfuscation.` : 'WebCrack did not accept the extracted code yet.'} {summary.deobfuscationSummary}</p>
                </div>
            ) : null}
        </section>
    )
}
