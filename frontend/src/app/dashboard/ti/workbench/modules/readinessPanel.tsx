import type { WorkbenchOrgContext, WorkbenchProductReadinessItem, WorkbenchAction, WorkbenchWorkflowStep } from '../types'
import { useState, useCallback } from 'react'
import { readJson } from './payloadParsing'
import { workflowStatusClass, label, customerOperationalText } from './presentation'
import Link from 'next/link'
import { ReadinessDetailField, ReadinessDetail } from './readinessDetail'

export function ProductReadinessPanel({ orgContext }: { orgContext?: WorkbenchOrgContext }) {
    const items = orgContext?.readiness.productReadiness || []
    const prioritizedItems = [...items].sort(readinessPrioritySort)
    const readyCount = items.filter(item => item.status === 'ready').length
    const blockerCount = items.length - readyCount
    const [selectedReadinessId, setSelectedReadinessId] = useState('')
    const [readinessActionState, setReadinessActionState] = useState<{ id: string, status: 'running' | 'ready' | 'blocked', text: string } | null>(null)
    const selectedReadiness = items.find(item => item.id === selectedReadinessId)
        || items.find(item => item.status !== 'ready')
        || items[0]
    const runReadinessAction = useCallback(async (item: WorkbenchProductReadinessItem, action: WorkbenchAction) => {
        if (action.method === 'GET') return
        const key = `${item.id}:${action.id}`
        if (action.disabledReason) {
            setReadinessActionState({ id: key, status: 'blocked', text: action.disabledReason })
            return
        }
        setReadinessActionState({ id: key, status: 'running', text: `${action.method} ${action.href}` })
        try {
            const response = await fetch(action.href, {
                method: action.method,
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(action.body || {}),
            })
            const payload = await readJson(response)
            if (!response.ok) throw new Error(payload.error?.message || response.statusText)
            setReadinessActionState({ id: key, status: 'ready', text: `${action.label} completed.` })
        } catch (error) {
            setReadinessActionState({ id: key, status: 'blocked', text: error instanceof Error ? error.message : String(error) })
        }
    }, [])
    if (!items.length) {
        return (
            <div className='rounded-lg border border-ui-border bg-ui-raised p-3 '>
                <div className='flex flex-wrap items-start justify-between gap-2 sm:items-center'>
                    <div>
                        <p className='text-xs font-semibold uppercase text-ui-muted '>Operations</p>
                        <p className='mt-1 text-xs leading-5 text-ui-muted '>Live lanes are connecting for this workspace.</p>
                    </div>
                    <span className={workflowStatusClass('needs_action')}>checking</span>
                </div>
            </div>
        )
    }

    return (
        <div className='rounded-lg border border-ui-border bg-ui-raised p-3 '>
            <div className='flex flex-wrap items-start justify-between gap-2 sm:items-center'>
                <div>
                    <p className='text-xs font-semibold uppercase text-ui-muted '>Live operations</p>
                    <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-muted '>
                        {orgContext?.readiness.fullChainReady
                            ? 'Org, watchlist, sources, dashboard alert, and delivery lanes are running.'
                            : `Collecting: ${(orgContext?.readiness.fullChainBlockedBy || ['dashboard alert evidence pending']).join('; ')}.`}
                    </p>
                </div>
                <div className='flex flex-wrap items-center justify-end gap-2'>
                    <Link href='/findings' className='inline-flex min-h-8 min-w-36 items-center justify-center rounded-lg border border-ui-border bg-ui-panel px-3 text-xs font-semibold text-ui-primary transition hover:bg-ui-raised '>
                        Open DWM queue
                    </Link>
                    <span className={workflowStatusClass(orgContext?.readiness.fullChainReady ? 'ready' : 'needs_action')}>
                        {orgContext?.readiness.fullChainReady ? 'ready' : `${blockerCount} syncing`}
                    </span>
                </div>
            </div>
            <div className='mt-3 grid gap-2 sm:grid-cols-3'>
                <ReadinessDetailField label='Running' value={`${readyCount}/${items.length}`} />
                <ReadinessDetailField label='Next lane' value={prioritizedItems[0]?.label || 'checking'} />
                <ReadinessDetailField label='Operations view' value='/findings' />
            </div>
            <div className='mt-3 grid gap-2'>
                {prioritizedItems.map((item, index) => {
                    const tone = productReadinessTone(item.status)
                    const active = selectedReadiness?.id === item.id
                    const operationalState = productReadinessOperationalState(item.status)
                    return (
                        <button
                            key={item.id}
                            type='button'
                            onClick={() => setSelectedReadinessId(item.id)}
                            className={`flex min-w-0 flex-wrap items-start justify-between gap-3 rounded-lg border px-3 py-2 text-left transition focus:outline-none focus:ring-2 focus:ring-ui-primary/50 ${active ? 'border-ui-primary/35 bg-ui-primary/10 dark:border-ui-border ' : 'border-ui-border bg-ui-panel hover:border-ui-border dark:border-ui-border dark:hover:border-ui-border '}`}
                            data-readiness-row-id={item.id}
                            data-readiness-state={operationalState}
                            data-readiness-blocker-count={item.blockerCount ?? (item.status === 'ready' ? 0 : 1)}
                            data-readiness-deep-link-target={item.deepLinkTarget || item.href || ''}
                            data-readiness-checked-at={item.checkedAt || item.proofTimestamp || ''}
                            data-readiness-proof-timestamp={item.proofTimestamp || item.checkedAt || ''}
                            data-readiness-unavailable-reason={item.unavailableReason || (item.status === 'unavailable' ? item.source : '')}
                            data-readiness-stale-after-seconds={item.staleAfterSeconds ?? ''}
                            data-readiness-expected-dashboard-row-id={item.expectedDashboardRowId || ''}
                            data-readiness-integration-probe-hint={item.integrationProbeHint || ''}
                            data-readiness-backend-contract-version={customerOperationalText(item.backendProofContractVersion || '')}
                            data-readiness-backend-proof-contract-version={customerOperationalText(item.backendProofContractVersion || '')}
                            data-readiness-owner-lane={item.ownerLane || ''}
                            data-readiness-operator-action={item.operatorAction || ''}
                            data-readiness-workflow-blocker={item.workflowBlocker || ''}
                            data-readiness-customer-impact={item.customerImpact || ''}
                            data-readiness-source-reference={customerOperationalText(item.evidenceProvenance || '')}
                            data-readiness-action-count={item.actions?.length || 0}
                            data-readiness-priority={index + 1}
                        >
                            <div className='min-w-0'>
                                <p className='wrap-break-word text-xs font-semibold text-ui-text '>{item.label}</p>
                                <p className='mt-0.5 wrap-break-word text-[11px] leading-4 text-ui-muted '>{item.detail}</p>
                                <p className='mt-1 wrap-break-word text-[10px] font-semibold uppercase text-ui-muted '>{[item.workflowBlocker, item.ownerLane, item.operatorAction].filter(Boolean).join(' · ')}</p>
                            </div>
                            <span className={`${workflowStatusClass(tone)} shrink-0`}>{productReadinessOperationalLabel(item.status)}</span>
                        </button>
                    )
                })}
            </div>
            {selectedReadiness ? <ReadinessDetail item={selectedReadiness} actionState={readinessActionState} onRunAction={runReadinessAction} /> : null}
        </div>
    )
}

export function statusBlocker(item: WorkbenchProductReadinessItem) {
    if (item.status === 'ready') return ''
    return item.unavailableReason || item.detail || item.source || 'Workflow lane is reading runtime data.'
}

export function readinessPrioritySort(first: WorkbenchProductReadinessItem, second: WorkbenchProductReadinessItem) {
    const statusWeight: Record<WorkbenchProductReadinessItem['status'], number> = {
        blocked: 0,
        unavailable: 1,
        needs_action: 2,
        ready: 3,
    }
    const firstWeight = statusWeight[first.status] ?? 4
    const secondWeight = statusWeight[second.status] ?? 4
    if (firstWeight !== secondWeight) return firstWeight - secondWeight
    return (second.blockerCount || 0) - (first.blockerCount || 0)
}

export function productReadinessTone(status: WorkbenchProductReadinessItem['status']): WorkbenchWorkflowStep['status'] {
    if (status === 'ready') return 'ready'
    return 'needs_action'
}

export function productReadinessOperationalState(status: WorkbenchProductReadinessItem['status']) {
    if (status === 'ready') return 'ready'
    if (status === 'unavailable') return 'syncing'
    return 'checking'
}

export function productReadinessOperationalLabel(status: WorkbenchProductReadinessItem['status']) {
    if (status === 'ready') return 'ready'
    if (status === 'unavailable') return 'syncing'
    return 'checking'
}
