'use client'

import { compactSourceReferenceLabel, handoffMissingLabel, sourceHealthChipClass } from '../pageClientShared'
import { decisionStepStatusClass, displayRequirementText, formatLabel, sourceBasisLabel, type SelectedCaseDraft } from '../pageModel'
import CopyPayloadButton from './copy-payload-button'
import SelectedPanelHeader from './selected-panel-header'
import SelectedWatchTerms from './selected-watch-terms'
import RequirementWarning from './requirement-warning'
import TiEvidenceCard from './ti-evidence-card'

export default function SelectedCaseDraftPanel({ draft }: { draft: SelectedCaseDraft }) {
    return (
        <div data-ti-selected-case-draft='true' className='border-t border-ui-border pt-3 dark:border-ui-border'>
            <SelectedPanelHeader title={<>Case draft · {formatLabel(draft.caseIntent)} · {draft.sourceRows.length} source row{draft.sourceRows.length === 1 ? '' : 's'}</>}>
                <span className={draft.ready ? decisionStepStatusClass('ready') : decisionStepStatusClass('blocked')}>{draft.ready ? 'ready' : 'syncing'}</span>
                <CopyPayloadButton label='Case draft' payload={draft} />
            </SelectedPanelHeader>
            <p className='mt-2 wrap-break-word text-[11px] text-ui-muted dark:text-ui-muted'>{displayRequirementText(draft.route || draft.endpoint)}</p>
            {draft.sourceRows.length ? (
                <div data-ti-selected-case-sources='true' className='mt-2 grid min-w-0 gap-2'>
                    {draft.sourceRows.slice(0, 2).map(row => (
                        <TiEvidenceCard key={`${row.sourceId ?? row.sourceName}:${row.provenance}:${row.captureId ?? 'missing'}`}>
                            <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                                <div className='min-w-0'>
                                    <p className='wrap-break-word text-[11px] font-semibold text-ui-text dark:text-ui-text'>{row.sourceName}{row.sourceId ? ' · source linked' : ''}</p>
                                    <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>{compactSourceReferenceLabel(row.provenance)}</p>
                                </div>
                                <span className={sourceHealthChipClass(row.state === 'ready' ? 'ready' : row.state === 'needs_capture' ? 'blocked' : 'review')}>
                                    {row.captureId ? 'source linked' : 'sources syncing'}
                                </span>
                            </div>
                            <p className='mt-1 wrap-break-word text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>
                                {typeof row.confidence === 'number' ? sourceBasisLabel(row.confidence) : 'evidence strength pending'}{row.missing.length ? ` · needs ${handoffMissingLabel(row.missing)}` : ''}
                            </p>
                        </TiEvidenceCard>
                    ))}
                </div>
            ) : null}
            <SelectedWatchTerms terms={draft.watchTerms} previewCount={3} />
            {draft.missing.length ? (
                <RequirementWarning items={draft.missing} limit={3} spacing='mt-2' />
            ) : (
                <p className='mt-2 text-[11px] leading-5 text-ui-success dark:text-ui-success'>Required case identifiers and evidence context are present.</p>
            )}
        </div>
    )
}
