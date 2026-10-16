import { DWM_CASE_EVIDENCE_PREVIEW_ROWS, DWM_CASE_REPORT_MAX_EVIDENCE, DWM_CASE_TIMELINE_PREVIEW_ROWS } from './constants'
import type { Dispatch, SetStateAction } from 'react'
import type { EvidenceRow, TimelineRow } from './evidenceTypes'
import { evidenceHashState, evidenceReferenceState, relativeTime, safeCaseEvidenceExcerpt, sourceReferenceState, stateLabel, toggleSelectedEvidence } from './model'
import { EmptyLine, EvidenceMobileRow, TimelineItem } from './presentation'

export function CaseEvidenceTimeline({ evidence, timeline, selectedEvidenceIds, setSelectedEvidenceIds, showAllEvidenceRows, setShowAllEvidenceRows }: {
    evidence: EvidenceRow[]
    timeline: TimelineRow[]
    selectedEvidenceIds: string[]
    setSelectedEvidenceIds: Dispatch<SetStateAction<string[]>>
    showAllEvidenceRows: boolean
    setShowAllEvidenceRows: Dispatch<SetStateAction<boolean>>
}) {
    const visibleEvidence = showAllEvidenceRows ? evidence.slice(0, DWM_CASE_REPORT_MAX_EVIDENCE) : evidence.slice(0, DWM_CASE_EVIDENCE_PREVIEW_ROWS)
    return (
        <section className='grid gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]'>
            <section className='rounded-lg border border-ui-border bg-ui-panel p-3'>
                <div className='flex items-center justify-between gap-2'>
                    <h2 className='text-sm font-semibold text-ui-text'>Evidence</h2>
                    <span className='text-xs text-ui-muted'>{evidence.length} rows · {selectedEvidenceIds.length} selected</span>
                </div>
                <div className='mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ui-border bg-ui-canvas p-2'>
                    <p className='text-xs text-ui-muted'><span className='font-semibold text-ui-text'>{selectedEvidenceIds.length}</span> of {Math.min(evidence.length, DWM_CASE_REPORT_MAX_EVIDENCE)} selected for the report</p>
                    <div className='flex gap-2'>
                        {evidence.length > DWM_CASE_EVIDENCE_PREVIEW_ROWS ? <button type='button' onClick={() => setShowAllEvidenceRows(value => !value)} className='rounded-md border border-ui-border px-2 py-1 text-xs font-semibold text-ui-text'>{showAllEvidenceRows ? 'Show fewer' : 'Show all'}</button> : null}
                        <button type='button' onClick={() => setSelectedEvidenceIds(evidence.map(row => row.id).filter(Boolean).slice(0, DWM_CASE_REPORT_MAX_EVIDENCE) as string[])} className='rounded-md border border-ui-border px-2 py-1 text-xs font-semibold text-ui-text'>Select all</button>
                        <button type='button' onClick={() => setSelectedEvidenceIds([])} className='rounded-md border border-ui-border px-2 py-1 text-xs font-semibold text-ui-text'>Clear</button>
                    </div>
                </div>
                <div className='rounded-lg border border-ui-border'>
                    {evidence.length ? (
                        <>
                            <div className='grid gap-2 p-2 md:hidden' data-dwm-case-evidence-mobile-list='true'>
                                {visibleEvidence.map((row, index) => <EvidenceMobileRow key={row.id || index} row={row} selected={Boolean(row.id && selectedEvidenceIds.includes(row.id))} onToggle={() => row.id && setSelectedEvidenceIds(selected => toggleSelectedEvidence(selected, row.id!))} />)}
                            </div>
                            <div className='hidden overflow-x-auto md:block'>
                                <table className='w-full min-w-190 text-left text-xs' data-dwm-case-evidence-desktop-table='true'>
                                    <thead className='bg-ui-canvas text-ui-muted'><tr>
                                        <th className='px-3 py-2 font-semibold'>Include</th>
                                        <th className='px-3 py-2 font-semibold'>Source</th>
                                        <th className='px-3 py-2 font-semibold'>Published / collected</th>
                                        <th className='px-3 py-2 font-semibold'>Excerpt</th>
                                        <th className='px-3 py-2 font-semibold'>Source details</th>
                                    </tr></thead>
                                    <tbody className='divide-y divide-ui-border bg-ui-panel'>
                                        {visibleEvidence.map((row, index) => (
                                            <tr key={row.id || index} className='hover:bg-ui-raised'>
                                                <td className='px-3 py-2 align-top'><input type='checkbox' aria-label={`Select ${row.sourceName || row.id || 'evidence'} for third-party report`} checked={Boolean(row.id && selectedEvidenceIds.includes(row.id))} disabled={!row.id} onChange={() => row.id && setSelectedEvidenceIds(selected => toggleSelectedEvidence(selected, row.id!))} /></td>
                                                <td className='px-3 py-2 align-top font-semibold text-ui-text'>{row.sourceName || sourceReferenceState(row)}<p className='text-[11px] font-normal text-ui-muted'>{stateLabel(row.sourceFamily)}</p></td>
                                                <td className='px-3 py-2 align-top text-ui-muted'>{relativeTime(row.observedAt || row.collectedAt)}</td>
                                                <td className='max-w-xl px-3 py-2 align-top text-ui-text'>{safeCaseEvidenceExcerpt(row)}</td>
                                                <td className='px-3 py-2 align-top text-[11px] font-semibold text-ui-muted'>{evidenceReferenceState(row)}<p>{evidenceHashState(row)}</p></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    ) : <EmptyLine text='No evidence rows are attached to this case.' />}
                </div>
            </section>
            <section className='rounded-lg border border-ui-border bg-ui-panel p-3'>
                <div className='flex items-center justify-between gap-2'>
                    <h2 className='text-sm font-semibold text-ui-text'>Activity</h2>
                    <span className='text-xs text-ui-muted'>{timeline.length} events</span>
                </div>
                <div className='max-h-[420px] overflow-y-auto pr-1'><div className='grid gap-2'>
                    {timeline.length ? timeline.slice(0, DWM_CASE_TIMELINE_PREVIEW_ROWS).map((row, index) => <TimelineItem key={row.id || index} row={row} compact />) : <EmptyLine text='No case events have been recorded yet.' />}
                </div></div>
            </section>
        </section>
    )
}
