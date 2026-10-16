import type { Dispatch, SetStateAction } from 'react'
import { ChevronRight, ExternalLink, Eye, FileText, Globe2, RotateCw, ScanSearch, ShieldCheck, Sparkles } from 'lucide-react'
import { PlainMetric, ProjectStateIcon } from './ShareChatReview'
import type { BrowserEvidence, BrowserProofJob, PendingEdit, PlainProjectState } from './shareChatTypes'

type Props = {
    showBuilderWorkflow: boolean
    setBuilderWorkflowOpen: Dispatch<SetStateAction<boolean>>
    sharePath: string
    projectState: PlainProjectState
    loading: boolean
    elapsedSeconds: number
    primaryAction: { label: string; detail: string; disabled: boolean; onClick: () => void }
    pendingEdit: PendingEdit | null
    treePaths: string[]
    browserProofJobs: BrowserProofJob[]
    browserEvidence: BrowserEvidence[]
    checkTarget: { label: string; url: string } | null
}

export function ShareChatHeader({ showBuilderWorkflow, setBuilderWorkflowOpen, sharePath, projectState, loading, elapsedSeconds, primaryAction, pendingEdit, treePaths, browserProofJobs, browserEvidence, checkTarget }: Props) {
    return <>
        <div className='flex items-center justify-between border-b border-ui-border px-3 py-2'>
            <div className='min-w-0'>
                <div className='flex items-center gap-2 text-sm font-semibold text-ui-text/88'>
                    <Sparkles className='h-4 w-4 text-ui-primary' />
                    Workspace assistant
                </div>
                <p className='truncate text-xs text-ui-text/45'>
                    {showBuilderWorkflow ? 'Build reviewable changes with visible checks.' : 'Ask mode will not change files.'}
                </p>
            </div>
            <div className='flex shrink-0 items-center gap-1 rounded-full border border-ui-border bg-ui-canvas/18 p-1 text-[11px]'>
                <button
                    type='button'
                    onClick={() => setBuilderWorkflowOpen(false)}
                    className={`h-7 cursor-pointer rounded-full px-3 font-medium transition ${showBuilderWorkflow ? 'text-ui-text/45 hover:bg-ui-panel/8 hover:text-ui-text/72' : 'bg-ui-panel text-background'}`}
                >
                    Ask
                </button>
                <button
                    type='button'
                    onClick={() => setBuilderWorkflowOpen(true)}
                    className={`h-7 cursor-pointer rounded-full px-3 font-medium transition ${showBuilderWorkflow ? 'bg-ui-panel text-background' : 'text-ui-text/45 hover:bg-ui-panel/8 hover:text-ui-text/72'}`}
                >
                    Build
                </button>
            </div>
        </div>
        <div className='border-b border-ui-border bg-ui-canvas/8 px-3 py-2'>
            <div className='flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] text-ui-text/52'>
                <span className='rounded-full border border-ui-border bg-ui-panel/[0.035] px-2 py-0.5 font-medium text-ui-text/66'>You approve changes</span>
                <span className='rounded-full border border-ui-border bg-ui-panel/[0.035] px-2 py-0.5 font-medium text-ui-text/66'>Current file context</span>
                <span className='min-w-0 truncate text-ui-text/38'>{sharePath}</span>
            </div>
        </div>
        {showBuilderWorkflow ? (
            <div className='border-b border-ui-border bg-ui-canvas/12 p-3'>
                <div className='mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-ui-border bg-ui-canvas/18 px-2 py-1.5 text-[11px] text-ui-text/52'>
                    <ShieldCheck className='h-3.5 w-3.5 shrink-0 text-ui-primary' />
                    <span className='font-medium text-ui-text/68'>Build is opt-in.</span>
                    <span>No files change until you approve the What changed cards.</span>
                </div>
                <div className='mb-2 grid gap-1.5 text-[11px] text-ui-text/58 sm:grid-cols-4'>
                    <PlainMetric icon={<FileText className='h-3.5 w-3.5' />} label='Build' value='Reviewable changes' />
                    <PlainMetric icon={<Eye className='h-3.5 w-3.5' />} label='Check' value='Browser review' />
                    <PlainMetric icon={<Globe2 className='h-3.5 w-3.5' />} label='Deploy' value='Publish checks' />
                    <PlainMetric icon={<RotateCw className='h-3.5 w-3.5' />} label='Recover' value='Rollback path' />
                </div>
                <div className={`grid gap-3 rounded-2xl border p-3 ${
                    projectState.tone === 'success'
                        ? 'border-ui-success/15 bg-ui-success/10'
                        : projectState.tone === 'danger'
                            ? 'border-ui-danger/15 bg-ui-raised/12'
                            : projectState.tone === 'attention'
                                ? 'border-ui-warning/15 bg-ui-warning/12'
                                : 'border-ui-border bg-ui-panel/[0.035]'
                } sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center`}>
                    <div className='flex min-w-0 items-start gap-3'>
                        <ProjectStateIcon state={projectState} loading={loading} />
                        <div className='min-w-0'>
                            <div className='flex flex-wrap items-center gap-2'>
                                <p className='text-sm font-semibold text-ui-text/88'>{projectState.label}</p>
                                {loading ? <span className='rounded-full border border-ui-border px-2 py-0.5 text-[11px] text-ui-text/45'>{elapsedSeconds}s</span> : null}
                            </div>
                            <p className='mt-1 text-xs leading-5 text-ui-text/56'>{projectState.detail}</p>
                        </div>
                    </div>
                    <button
                        type='button'
                        onClick={() => void primaryAction.onClick()}
                        disabled={primaryAction.disabled}
                        className='inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-full bg-ui-panel px-4 text-sm font-semibold text-background transition hover:bg-ui-panel/88 disabled:cursor-default disabled:opacity-45'
                    >
                        {primaryAction.label}
                        <ChevronRight className='h-4 w-4' />
                    </button>
                    <p className='text-xs leading-5 text-ui-text/45 sm:col-span-2'>{primaryAction.detail}</p>
                </div>
                <div className='mt-2 grid gap-2 text-[11px] text-ui-text/58 sm:grid-cols-3'>
                    <PlainMetric icon={<FileText className='h-3.5 w-3.5' />} label={pendingEdit?.status === 'pending' ? 'Changes waiting for review' : 'Project files'} value={pendingEdit?.status === 'pending' ? `${pendingEdit.changes.length}` : treePaths.length ? `${treePaths.length}` : '1'} />
                    <PlainMetric icon={<Eye className='h-3.5 w-3.5' />} label='Browser check' value={browserProofJobs.length ? `${browserProofJobs.filter((job) => job.status === 'completed').length}/${browserProofJobs.length}` : browserEvidence.length ? 'Done' : 'Not run yet'} />
                    <PlainMetric icon={<ShieldCheck className='h-3.5 w-3.5' />} label='Safety' value='You approve changes' />
                </div>
            </div>
        ) : null}

        {showBuilderWorkflow && checkTarget?.url ? (
            <div className='border-b border-ui-border bg-ui-canvas/10 px-3 py-2'>
                <div className='flex items-center justify-between gap-3 rounded-lg border border-ui-border bg-ui-panel/[0.035] px-2 py-1.5 text-[11px] text-ui-text/62'>
                    <div className='flex min-w-0 items-center gap-1.5'>
                        <Globe2 className='h-3.5 w-3.5 shrink-0 text-ui-primary' />
                        <span className='shrink-0 font-semibold text-ui-text/68'>Check target</span>
                        <span className='truncate text-ui-text/42'>{checkTarget.label}</span>
                        <span className='truncate text-ui-text/52'>{checkTarget.url}</span>
                    </div>
                    <a href={checkTarget.url} target='_blank' rel='noopener noreferrer' aria-label='Open check target' className='grid h-7 w-7 shrink-0 place-items-center rounded-md text-ui-text/45 transition hover:bg-ui-panel/8 hover:text-ui-text'>
                        <ExternalLink className='h-3.5 w-3.5' />
                    </a>
                </div>
            </div>
        ) : null}

        {showBuilderWorkflow && browserEvidence[0] ? (
            <div className='border-b border-ui-border bg-ui-canvas/10 px-3 py-2'>
                <div className='grid gap-2 rounded-lg border border-ui-border bg-ui-panel/[0.035] px-2 py-1.5 text-[11px] text-ui-text/62 sm:grid-cols-[minmax(0,1fr)_auto]'>
                    <div className='flex min-w-0 items-start gap-1.5'>
                        <ScanSearch className='h-3.5 w-3.5 shrink-0 text-ui-primary' />
                        <div className='min-w-0'>
                            <p className='truncate font-semibold text-ui-text/72'>Browser check: {browserEvidence[0].title || 'Untitled page'}</p>
                            <p className='truncate text-ui-text/42'>A real browser inspected the rendered result and saved review evidence.</p>
                        </div>
                    </div>
                    <div className='flex min-w-0 flex-wrap items-center gap-1.5 sm:justify-end'>
                        <span className='rounded-full border border-ui-border px-2 py-0.5 text-ui-text/50'>{browserEvidence[0].structure?.headings?.length || 0} headings</span>
                        <span className='rounded-full border border-ui-border px-2 py-0.5 text-ui-text/50'>{browserEvidence[0].pageErrors?.filter(Boolean).length || 0} issues</span>
                        <span className='rounded-full border border-ui-border px-2 py-0.5 text-ui-text/50'>{browserEvidence[0].screenshotPath ? 'Screenshot captured' : 'No screenshot'}</span>
                        <span className='rounded-full border border-ui-border px-2 py-0.5 text-ui-text/42'>{browserEvidence.length} saved</span>
                    </div>
                </div>
            </div>
        ) : null}

    </>
}
