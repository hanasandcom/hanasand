'use client'

import { Activity, ChevronDown, CircleCheckBig, Hourglass, ServerCrash } from 'lucide-react'
import LogViewer from './logViewer'
import type { ReactNode } from 'react'
import { useState } from 'react'
import TestMetricCharts, { type TestMetrics } from './testMetricCharts'
import { TestEmptyState } from './testEmptyState'

type TestContentProps = {
    test: Test
    showLogs: boolean
    showErrors: boolean
}

export default function TestContent({ test, showLogs, showErrors }: TestContentProps) {
    const [resultsExpanded, setResultsExpanded] = useState(true)
    const [evidenceExpanded, setEvidenceExpanded] = useState(true)
    const isDone = test.status === 'done'
    const isFailed = test.status === 'failed'
    const isPending = test.status === 'pending'
    const metrics = (test.summary || {}) as TestMetrics
    const logs = test.logs || []
    const errors = test.errors || []
    const statusTone = isFailed
        ? 'border-ui-danger bg-ui-danger/15 text-ui-danger'
        : isDone
            ? 'border-ui-success bg-ui-success/15 text-ui-success'
            : isPending
                ? 'border-ui-warning bg-ui-warning/15 text-ui-warning'
                : 'border-ui-primary bg-ui-primary/15 text-ui-primary'
    const StatusIcon = isFailed ? ServerCrash : isDone ? CircleCheckBig : isPending ? Hourglass : Activity

    return (
        <div className='relative grid min-h-0 min-w-0 content-start grid-rows-[auto_auto] gap-4 overflow-hidden pb-1 xl:h-full xl:grid-rows-[auto_minmax(0,1fr)]'>
            <div className='flex flex-wrap items-start justify-between gap-3 border-b border-ui-border pb-3'>
                <div className='min-w-0'>
                    <h1 className='text-lg font-semibold text-ui-text'>Results</h1>
                    <p className='mt-1 max-w-2xl text-xs leading-5 text-ui-muted'>
                        Metrics, charts, logs, and evidence from the selected run.
                    </p>
                </div>
                <div className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border px-3 text-xs font-semibold ${statusTone}`}>
                    <StatusIcon className='h-4 w-4' />
                    <span>{isFailed ? 'Failed' : isDone ? 'Complete' : isPending ? 'Pending' : test.status}</span>
                </div>
                <button type='button' aria-label={`${resultsExpanded ? 'Collapse' : 'Expand'} results`} aria-expanded={resultsExpanded} onClick={() => setResultsExpanded(value => !value)} className='grid h-9 w-9 shrink-0 place-items-center rounded border border-ui-border text-ui-muted xl:hidden'>
                    <ChevronDown className={`h-4 w-4 transition-transform ${resultsExpanded ? 'rotate-180' : ''}`} />
                </button>
            </div>

            <div className={`min-w-0 overflow-y-auto overflow-x-hidden pr-1 ${resultsExpanded ? '' : 'hidden xl:block'}`}>
                <div className='grid min-w-0 gap-4'>
                    <TestMetricCharts metrics={metrics} isDone={isDone} />

                    <div className='grid min-h-64 min-w-0 gap-3 lg:grid-cols-2'>
                        <section className='grid min-w-0 gap-2 rounded-lg border border-ui-border bg-ui-raised p-3 lg:col-span-2'>
                            <div className='flex items-center justify-between gap-3'>
                                <h2 className='text-sm font-semibold text-ui-text'>Run output</h2>
                                <button type='button' aria-label={`${evidenceExpanded ? 'Collapse' : 'Expand'} run output`} aria-expanded={evidenceExpanded} onClick={() => setEvidenceExpanded(value => !value)} className='grid h-8 w-8 shrink-0 place-items-center rounded border border-ui-border text-ui-muted xl:hidden'>
                                    <ChevronDown className={`h-4 w-4 transition-transform ${evidenceExpanded ? 'rotate-180' : ''}`} />
                                </button>
                            </div>
                            <div className={`grid min-w-0 gap-3 lg:grid-cols-2 ${evidenceExpanded ? '' : 'hidden xl:grid'}`}>
                                {showLogs && <LogPanel title={`Logs (${logs.length})`} empty='Log stream is live; no recent lines.' hasContent={logs.length > 0}><LogViewer isDone={isDone} text={logs} /></LogPanel>}
                                {showErrors && <LogPanel title={`Errors (${errors.length})`} empty='Error stream is live; no recent errors.' hasContent={errors.length > 0} danger><LogViewer text={errors} /></LogPanel>}
                                {!showLogs && !showErrors && <TestEmptyState icon={<ServerCrash className='h-5 w-5' />} title='Logs and errors are hidden' body='Use the controls in the details panel to show run evidence.' />}
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    )
}

function LogPanel({ title, empty, children, hasContent, danger = false }: { title: string, empty: string, children: ReactNode, hasContent: boolean, danger?: boolean }) {
    return (
        <section className={`grid min-h-64 min-w-0 grid-rows-[auto_minmax(0,1fr)] gap-2 rounded-lg border p-3 ${danger ? 'border-ui-danger bg-ui-raised/15' : 'border-ui-border bg-ui-raised'}`}>
            <h2 className={`text-sm font-semibold ${danger ? 'text-ui-text' : 'text-ui-text'}`}>{title}</h2>
            <div className='min-h-0 min-w-0'>
                {hasContent ? children : <div className='grid h-full place-items-center rounded-md border border-dashed border-ui-border bg-ui-panel p-4 text-center text-sm text-ui-muted'>{empty}</div>}
            </div>
        </section>
    )
}
