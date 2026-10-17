'use client'

import { TI_WORKBENCH_PREVIEW_ROWS, formatDate, sourceHealthChipClass } from '../pageClientShared'
import { actorOperationsRowsFor, displayRequirementText, sourceBasisLabel } from '../pageModel'
import { Eye, Send } from 'lucide-react'
import { TiSearchResponse } from '@/utils/ti/search'
import { type ActorArtifactKind } from '@/utils/ti/actorWorkbench'
import { type TiActorIntelligenceProfile } from '@/utils/ti/actorIntelligence'
import { useMemo } from 'react'
import { victimObservationsFor } from '@/utils/ti/actorProfile'
import CopyPayloadButton from './copy-payload-button'
import StripActionButton from './strip-action-button'
import SelectableWorkbenchPanel from './SelectableWorkbenchPanel'
import { useSelectedPreviewRows, useSelectedWorkbenchRow } from './selectedPreviewList'

export default function ActorOperationsMatrix({
    result,
    actor,
    victimObservations,
    selectedArtifactId,
    onSelectArtifactBy,
    onEscalate,
    onReview,
}: {
    result: TiSearchResponse
    actor: TiActorIntelligenceProfile
    victimObservations: ReturnType<typeof victimObservationsFor>
    selectedArtifactId?: string
    onSelectArtifactBy: (kind: ActorArtifactKind, value: string) => void
    onEscalate: () => void
    onReview: () => void
}) {
    const rows = useMemo(() => actorOperationsRowsFor(result, actor, victimObservations), [actor, result, victimObservations])
    const { selectedRow, setSelectedRowId } = useSelectedWorkbenchRow(rows)
    const preview = useSelectedPreviewRows(rows, selectedRow, TI_WORKBENCH_PREVIEW_ROWS)
    const detail = selectedRow ? (
        <div className='grid gap-2'>
            <div>
                <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Selected detail</p>
                <h3 className='mt-1 wrap-break-word text-sm font-semibold text-ui-text dark:text-ui-text'>{selectedRow.label}</h3>
                <p className='mt-1 text-xs leading-5 text-ui-muted dark:text-ui-muted'>{displayRequirementText(selectedRow.detail)}</p>
            </div>
            <p className='wrap-break-word text-xs font-semibold text-ui-muted dark:text-ui-muted'>
                {sourceBasisLabel(selectedRow.confidence)} · {selectedRow.source}
            </p>
            <div className='grid grid-cols-2 gap-1.5'>
                <StripActionButton icon={<Eye className='h-3.5 w-3.5' />} onClick={onReview}>Review</StripActionButton>
                <StripActionButton icon={<Send className='h-3.5 w-3.5' />} onClick={onEscalate}>Escalate</StripActionButton>
            </div>
            {selectedRow.artifactKind && selectedRow.artifactLookup ? (
                <button type='button' onClick={() => onSelectArtifactBy(selectedRow.artifactKind!, selectedRow.artifactLookup!)} className='ui-button ui-button-secondary min-h-8 px-2 text-xs'>
                    Open detail
                </button>
            ) : null}
        </div>
    ) : <p className='text-sm text-ui-muted dark:text-ui-muted'>Select a detail to inspect.</p>

    return (
        <SelectableWorkbenchPanel
            sectionProps={{ 'data-ti-actor-operations-matrix': 'true' }}
            title='Attack details'
            description='Methods, infrastructure, and targeting details with sources.'
            headerActions={
                <>
                    <span className='rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-[11px] font-semibold text-ui-muted dark:border-ui-border dark:bg-ui-panel dark:text-ui-muted'>{rows.length} details</span>
                    {selectedRow ? <CopyPayloadButton label='Copy detail' payload={selectedRow.payload} /> : null}
                </>
            }
            columnsClassName='lg:grid-cols-[minmax(0,1fr)_18rem]'
            detailBreakpoint='lg'
            preview={preview}
            moreLabel={count => `Show ${count} more details`}
            lessLabel='Show key details only'
            detail={detail}
            emptyState={!rows.length ? <p className='p-4 text-sm text-ui-muted dark:text-ui-muted'>Add technique, infrastructure, or victim context before case review.</p> : null}
        >
            <table className='min-w-170 w-full border-collapse text-left text-xs'>
                <thead className='bg-ui-panel text-[11px] uppercase text-ui-muted dark:bg-ui-raised dark:text-ui-muted'>
                    <tr>
                        <th className='px-3 py-2 font-semibold'>Type</th>
                        <th className='px-3 py-2 font-semibold'>Name</th>
                        <th className='px-3 py-2 font-semibold'>Source</th>
                        <th className='px-3 py-2 font-semibold'>Freshness</th>
                        <th className='px-3 py-2 font-semibold'>Basis</th>
                    </tr>
                </thead>
                <tbody className='divide-y divide-ui-border'>
                    {preview.visibleRows.map(row => {
                        const active = selectedRow?.id === row.id || (row.artifactLookup && selectedArtifactId?.includes(row.artifactLookup.toLowerCase().replace(/[^a-z0-9]+/g, '-')))
                        return (
                            <tr key={row.id} className={`${active ? 'bg-ui-primary/10 dark:bg-ui-primary/10' : 'bg-ui-panel dark:bg-ui-panel'} align-top`}>
                                <td className='px-3 py-2'>
                                    <button type='button' onClick={() => setSelectedRowId(row.id)} className='rounded-md bg-ui-raised px-2 py-1 text-[11px] font-semibold text-ui-muted focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:bg-ui-raised dark:text-ui-muted'>{row.type}</button>
                                </td>
                                <td className='px-3 py-2'>
                                    <button
                                        type='button'
                                        onClick={() => {
                                            setSelectedRowId(row.id)
                                            if (row.artifactKind && row.artifactLookup) onSelectArtifactBy(row.artifactKind, row.artifactLookup)
                                        }}
                                        className='grid min-w-0 text-left focus:outline-none focus:ring-2 focus:ring-ui-primary/35'
                                    >
                                        <span className='wrap-break-word font-semibold text-ui-text dark:text-ui-text'>{row.label}</span>
                                        <span className='mt-1 line-clamp-2 text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>{displayRequirementText(row.detail)}</span>
                                    </button>
                                </td>
                                <td className='px-3 py-2'>
                                    <p className='wrap-break-word font-semibold text-ui-text dark:text-ui-text'>{row.source}</p>
                                    <p className='mt-1 text-[11px] text-ui-muted dark:text-ui-muted'>{row.sourceFamily}</p>
                                </td>
                                <td className='px-3 py-2'>
                                    <span className={sourceHealthChipClass(row.freshness)}>{row.freshness}</span>
                                    <p className='mt-1 text-[11px] text-ui-muted dark:text-ui-muted'>{formatDate(row.timestamp)}</p>
                                </td>
                                <td className='px-3 py-2 font-semibold text-ui-text dark:text-ui-text'>{sourceBasisLabel(row.confidence)}</td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </SelectableWorkbenchPanel>
    )
}
