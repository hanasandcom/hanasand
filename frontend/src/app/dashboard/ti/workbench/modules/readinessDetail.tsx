import type { WorkbenchProductReadinessItem, WorkbenchAction } from '../types'
import { statusBlocker, productReadinessTone } from './readinessPanel'
import { customerOperationalText, workflowStatusClass, label, relativeTime, formatSeconds } from './presentation'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'

export function ReadinessDetail({ item, actionState, onRunAction }: { item: WorkbenchProductReadinessItem, actionState: { id: string, status: 'running' | 'ready' | 'blocked', text: string } | null, onRunAction: (item: WorkbenchProductReadinessItem, action: WorkbenchAction) => void | Promise<void> }) {
    const blocker = statusBlocker(item)
    const statusTime = item.proofTimestamp || item.checkedAt || ''
    const tone = productReadinessTone(item.status)
    const actions = item.actions || []
    const metrics = readinessDetailMetrics(item)
    return (
        <div
            className='mt-3 rounded-lg border border-ui-border bg-ui-panel p-3 '
            data-readiness-detail={item.id}
            data-readiness-detail-state={item.status}
            data-readiness-detail-owner={item.ownerLane || ''}
            data-readiness-detail-action={item.operatorAction || ''}
            data-readiness-detail-contract={customerOperationalText(item.backendProofContractVersion || '')}
            data-readiness-detail-blocker={blocker}
            data-readiness-detail-workflow-blocker={item.workflowBlocker || ''}
            data-readiness-detail-customer-impact={item.customerImpact || ''}
            data-readiness-detail-source-reference={customerOperationalText(item.evidenceProvenance || '')}
            data-readiness-detail-href={item.deepLinkTarget || item.href || ''}
            data-readiness-detail-action-count={actions.length}
        >
            <div className='flex flex-wrap items-start justify-between gap-3'>
                <div className='min-w-0'>
                    <p className='text-[10px] font-semibold uppercase text-ui-muted '>Operation detail</p>
                    <h3 className='mt-1 wrap-break-word text-sm font-semibold text-ui-text '>{item.label}</h3>
                </div>
                <span className={workflowStatusClass(tone)}>{label(item.status)}</span>
            </div>
            <div className='mt-3 grid gap-2 sm:grid-cols-2'>
                <ReadinessDetailField label='Workflow' value={item.workflowBlocker || 'workflow attached'} />
                <ReadinessDetailField label='Owner' value={item.ownerLane || 'shared ops'} />
                <ReadinessDetailField label='Next action' value={item.operatorAction || 'monitor workflow'} />
                <ReadinessDetailField label='Last check' value={statusTime ? relativeTime(statusTime) : 'checking'} />
                <ReadinessDetailField label='Evidence' value={item.backendProofContractVersion || item.source || 'runtime evidence'} />
                <ReadinessDetailField label='Source trail' value={customerOperationalText(item.evidenceProvenance || item.source || 'runtime source')} />
                <ReadinessDetailField label='Refresh window' value={formatSeconds(item.staleAfterSeconds)} />
                <ReadinessDetailField label='Source' value={item.source || 'source'} />
                {metrics.map(metric => (
                    <ReadinessDetailField key={metric.label} label={metric.label} value={metric.value} />
                ))}
            </div>
            <div className='mt-3 rounded-lg border border-ui-border bg-ui-raised p-3 '>
                <p className='text-[10px] font-semibold uppercase text-ui-muted '>{item.status === 'ready' ? 'Evidence' : 'Needs attention'}</p>
                <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-text '>{item.status === 'ready' ? item.detail : blocker}</p>
                {item.customerImpact ? <p className='mt-2 wrap-break-word text-[11px] leading-4 text-ui-muted '>Impact: {item.customerImpact}</p> : null}
                {item.integrationProbeHint ? <p className='mt-2 wrap-break-word text-[11px] leading-4 text-ui-muted '>{item.integrationProbeHint}</p> : null}
            </div>
            {actions.length ? (
                <div className='mt-3 rounded-lg border border-ui-border bg-ui-raised p-3 ' data-readiness-detail-actions={item.id}>
                    <p className='text-[10px] font-semibold uppercase text-ui-muted '>Actions</p>
                    <div className='mt-2 flex flex-wrap gap-2'>
                        {actions.map(action => {
                            const actionKey = `${item.id}:${action.id}`
                            const busy = actionState?.id === actionKey && actionState.status === 'running'
                            return action.method === 'GET' ? (
                                <Link
                                    key={action.id}
                                    href={action.href}
                                    data-readiness-action-id={action.id}
                                    data-readiness-action-method={action.method}
                                    className='inline-flex min-h-9 min-w-36 items-center justify-center gap-1.5 rounded-lg border border-ui-border bg-ui-panel px-3 text-xs font-semibold text-ui-primary transition hover:bg-ui-raised '
                                >
                                    {action.label}
                                    <ExternalLink className='h-3.5 w-3.5' />
                                </Link>
                            ) : (
                                <button
                                    key={action.id}
                                    type='button'
                                    disabled={busy || Boolean(action.disabledReason)}
                                    title={action.disabledReason}
                                    data-readiness-action-id={action.id}
                                    data-readiness-action-method={action.method}
                                    onClick={() => onRunAction(item, action)}
                                    className='inline-flex min-h-9 min-w-36 items-center justify-center rounded-lg border border-ui-border bg-ui-panel px-3 text-xs font-semibold text-ui-primary transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/50 disabled:cursor-not-allowed disabled:opacity-60 '
                                >
                                    {busy ? 'Running...' : action.label}
                                </button>
                            )
                        })}
                    </div>
                    {actionState && actionState.id.startsWith(`${item.id}:`) ? (
                        <p className={`mt-2 wrap-break-word text-[11px] leading-4 ${actionState.status === 'blocked' ? 'text-ui-warning ' : 'text-ui-muted '}`}>{customerOperationalText(actionState.text)}</p>
                    ) : null}
                </div>
            ) : null}
            {item.href ? (
                <div className='mt-3 flex flex-wrap gap-2'>
                    <Link href={item.href} className='inline-flex min-h-9 min-w-44 items-center justify-center rounded-lg border border-ui-border bg-ui-raised px-3 text-xs font-semibold text-ui-primary transition hover:bg-ui-raised '>
                        Open workflow
                    </Link>
                </div>
            ) : (
                <p className='mt-3 text-xs leading-5 text-ui-muted '>Workflow link appears when a direct drill-in is available.</p>
            )}
        </div>
    )
}

export function readinessDetailMetrics(item: WorkbenchProductReadinessItem) {
    if (item.id === 'dashboard_evidence') {
        return [
            typeof item.candidateCount === 'number' || typeof item.matchedCandidateCount === 'number'
                ? { label: 'Candidates', value: String(item.candidateCount ?? item.matchedCandidateCount ?? 0) }
                : undefined,
            typeof item.generationEvidenceWindowCaptureCount === 'number' || typeof item.captureRefCount === 'number'
                ? { label: 'Evidence window', value: `${item.generationEvidenceWindowCaptureCount ?? item.captureRefCount ?? 0} captures` }
                : undefined,
            typeof item.missingRouteCandidateCount === 'number'
                ? { label: 'Route gaps', value: `${item.missingRouteCandidateCount} candidate${item.missingRouteCandidateCount === 1 ? '' : 's'}` }
                : undefined,
            item.latestEvidenceAt ? { label: 'Latest evidence', value: relativeTime(item.latestEvidenceAt) } : undefined,
            item.generationEvidenceWindowSourceFamilies?.length
                ? { label: 'Source families', value: item.generationEvidenceWindowSourceFamilies.join(', ') }
                : undefined,
        ].filter((metric): metric is { label: string, value: string } => Boolean(metric))
    }
    if (item.id === 'org_alert_export') {
        return [
            typeof item.activeTermCount === 'number' ? { label: 'Active terms', value: String(item.activeTermCount) } : undefined,
            typeof item.pausedCount === 'number' ? { label: 'Paused', value: String(item.pausedCount) } : undefined,
            typeof item.archivedCount === 'number' ? { label: 'Archived', value: String(item.archivedCount) } : undefined,
            typeof item.canGenerateAlerts === 'boolean' ? { label: 'Alert export', value: item.canGenerateAlerts ? 'ready' : 'syncing' } : undefined,
            item.exportedAt ? { label: 'Exported', value: relativeTime(item.exportedAt) } : undefined,
            item.organizationId ? { label: 'Organization', value: item.organizationId } : undefined,
        ].filter((metric): metric is { label: string, value: string } => Boolean(metric))
    }
    if (item.id === 'source_inventory_probe') {
        return [
            item.workerStatus ? { label: 'Worker', value: item.workerStatus } : undefined,
            typeof item.activeSourceCount === 'number' || typeof item.registeredTotal === 'number'
                ? { label: 'Sources', value: `${item.activeSourceCount ?? 0}/${item.registeredTotal ?? 0} active` }
                : undefined,
            typeof item.sourceFamilyCount === 'number' ? { label: 'Source families', value: String(item.sourceFamilyCount) } : undefined,
            typeof item.parserSourceFamilyCount === 'number' ? { label: 'Parser families', value: String(item.parserSourceFamilyCount) } : undefined,
            typeof item.contractLookupRows === 'number' ? { label: 'Contract rows', value: String(item.contractLookupRows) } : undefined,
            typeof item.receiptMatrixRows === 'number' ? { label: 'Delivery rows', value: String(item.receiptMatrixRows) } : undefined,
            typeof item.receiptMatrixBlockedRows === 'number' ? { label: 'Delivery checks', value: String(item.receiptMatrixBlockedRows) } : undefined,
            item.workerLastRunAt ? { label: 'Worker run', value: relativeTime(item.workerLastRunAt) } : undefined,
        ].filter((metric): metric is { label: string, value: string } => Boolean(metric))
    }
    if (item.id === 'end_to_end_workflow') {
        return [
            typeof item.endToEndWorkflowReadyStepCount === 'number' || typeof item.endToEndWorkflowStepCount === 'number'
                ? { label: 'Ready steps', value: `${item.endToEndWorkflowReadyStepCount ?? 0}/${item.endToEndWorkflowStepCount ?? 0}` }
                : undefined,
            typeof item.endToEndWorkflowBlockedStepCount === 'number' ? { label: 'Syncing steps', value: String(item.endToEndWorkflowBlockedStepCount) } : undefined,
            typeof item.endToEndWorkflowMissingFieldCount === 'number' ? { label: 'Missing fields', value: String(item.endToEndWorkflowMissingFieldCount) } : undefined,
        ].filter((metric): metric is { label: string, value: string } => Boolean(metric))
    }
    return []
}

export function ReadinessDetailField({ label: fieldLabel, value }: { label: string, value: string }) {
    return (
        <div className='rounded-lg border border-ui-border bg-ui-raised px-3 py-2 '>
            <p className='text-[10px] font-semibold uppercase text-ui-muted '>{fieldLabel}</p>
            <p className='mt-1 wrap-break-word text-xs font-semibold text-ui-text '>{value}</p>
        </div>
    )
}
