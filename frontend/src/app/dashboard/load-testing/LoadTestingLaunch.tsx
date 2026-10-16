import { Globe2, Search, ShieldCheck } from 'lucide-react'
import type { FormEventHandler } from 'react'
import { DashboardPanel } from '@/components/dashboard/ui'
import { LoadTestOperationsSnapshot } from './LoadTestOperationsSnapshot'
import { LoadTestScenarioPicker } from './LoadTestScenarioPicker'
import type { Scenario } from './loadTestingScenarios'
import { latestP95 } from './loadTestingScenarios'

type Props = {
    targetUrl: string
    onTargetUrlChange: (value: string) => void
    scenario: Scenario
    selectedScenarioId: Scenario['id']
    onScenarioChange: (id: Scenario['id']) => void
    permissionConfirmed: boolean
    onPermissionChange: (value: boolean) => void
    validTarget: boolean
    isStarting: boolean
    error: string
    onSubmit: FormEventHandler<HTMLFormElement>
    runningCount: number
    queuedCount: number
    scanCount: number
    failedCount: number
    latestScan?: Test
    loadedAt: Date | null
}

export function LoadTestingLaunch(props: Props) {
    const p95 = latestP95(props.latestScan)
    return <DashboardPanel className='overflow-hidden rounded-lg border-ui-border bg-ui-panel p-0 shadow-sm'>
        <div className='grid gap-0 lg:grid-cols-[minmax(0,1fr)_20rem]'>
            <div className='grid gap-4 p-4 sm:p-5 lg:p-6'>
                <div className='max-w-3xl'>
                    <p className='inline-flex items-center gap-2 rounded-full border border-ui-primary/30 bg-ui-primary/10 px-3 py-1 text-xs font-semibold text-ui-primary'>
                        <ShieldCheck className='h-3.5 w-3.5' />
                        Permission-gated
                    </p>
                    <h2 className='mt-3 text-2xl font-semibold tracking-normal text-ui-text md:text-3xl'>Check an endpoint you control</h2>
                    <p className='mt-2 text-sm leading-6 text-ui-muted'>Run a permitted HTTP check, then open the result for latency, failures, logs, and response evidence.</p>
                </div>
                <form onSubmit={props.onSubmit} className='grid gap-3'>
                    <div className='flex min-w-0 flex-col gap-2 xl:flex-row'>
                        <label className='relative min-w-0 flex-1'>
                            <span className='sr-only'>Endpoint URL</span>
                            <Globe2 className='absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ui-subtle' />
                            <input
                                className='h-12 w-full rounded-lg border border-ui-border bg-ui-panel pl-12 pr-4 text-sm font-medium text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary focus:ring-4 focus:ring-ui-primary/20'
                                value={props.targetUrl}
                                onChange={event => props.onTargetUrlChange(event.target.value)}
                                placeholder='https://api.example.com/health'
                            />
                        </label>
                        <button
                            type='submit'
                            disabled={!props.validTarget || !props.permissionConfirmed || props.isStarting}
                            className='inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-lg bg-ui-primary px-5 text-sm font-semibold text-ui-on-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:border disabled:border-ui-border disabled:bg-ui-raised disabled:text-ui-muted'
                        >
                            <Search className='h-4 w-4' />
                            {props.isStarting ? 'Starting' : 'Start check'}
                        </button>
                    </div>
                    <PermissionGate {...props} />
                    <ScenarioSummary scenario={props.scenario} />
                    <LoadTestScenarioPicker selectedScenarioId={props.selectedScenarioId} onScenarioChange={props.onScenarioChange} />
                    {props.error ? <p className='text-sm text-ui-text'>{props.error}</p> : null}
                </form>
            </div>
            <LoadTestOperationsSnapshot
                runningCount={props.runningCount}
                queuedCount={props.queuedCount}
                scanCount={props.scanCount}
                failedCount={props.failedCount}
                p95={p95}
                loadedAt={props.loadedAt}
            />
        </div>
    </DashboardPanel>
}

function PermissionGate({ validTarget, permissionConfirmed, onPermissionChange }: Pick<Props, 'validTarget' | 'permissionConfirmed' | 'onPermissionChange'>) {
    return <label
        className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 text-sm transition ${permissionConfirmed ? 'border-ui-success/35 bg-ui-success/10 text-ui-text' : 'border-ui-border bg-ui-raised text-ui-muted'}`}
        data-load-test-permission-gate
    >
        <input
            type='checkbox'
            checked={permissionConfirmed}
            onChange={event => onPermissionChange(event.target.checked)}
            className='mt-1 h-4 w-4 rounded border-ui-border text-ui-primary focus:ring-ui-primary/30'
        />
        <span className='grid gap-1'>
            <span className='font-semibold text-ui-text'>I own this endpoint or have written permission to test it.</span>
            <span className='text-xs leading-5 text-ui-muted'>{validTarget ? 'Ready for a baseline-safe check.' : 'Enter a valid HTTP/S endpoint before starting.'}</span>
        </span>
    </label>
}

function ScenarioSummary({ scenario }: { scenario: Scenario }) {
    return <div className='flex flex-wrap items-center gap-2 text-xs text-ui-subtle'>
        <span className='rounded-md border border-ui-border bg-ui-raised px-2.5 py-1.5 font-medium text-ui-text'>{scenario.label}: {scenario.detail}</span>
        <span className='rounded-md border border-ui-border bg-ui-raised px-2.5 py-1.5'>{Math.round(scenario.timeout / 1000)}s timeout</span>
        <span className='rounded-md border border-ui-border bg-ui-raised px-2.5 py-1.5'>p95/p99 evidence</span>
    </div>
}
