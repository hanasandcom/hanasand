import { Panel, Empty, PreviewLink, TrustItem, WorkspaceStatusBadge } from './workbenchPaneDisplay'
import { Archive, Download, FileText, History, LifeBuoy, RefreshCcw, ShieldCheck } from 'lucide-react'
import { supportBundleHref } from './workbenchPaneTrust'

type WorkspaceReleasePanelsProps = { trustRelease: AIRelease | null, trust: AIReleaseTrust | null, launchReport: string[], releases: AIRelease[], rollbackPendingId: string | null, onRollbackRelease: (releaseId: string) => void | Promise<void> }

export function WorkspaceReleasePanels(props: WorkspaceReleasePanelsProps) {
    if (!props.releases.length) return null

    return <details className='rounded-lg bg-ui-panel p-3 outline outline-ui-border'>
        <summary className='cursor-pointer text-sm font-medium text-ui-text'>Launch history and recovery ({props.releases.length})</summary>
        <div className='mt-3 space-y-3'>
            <WorkspaceReleasePanelsContent {...props} />
        </div>
    </details>
}

function WorkspaceReleasePanelsContent({ trustRelease, trust, launchReport, releases, rollbackPendingId, onRollbackRelease }: WorkspaceReleasePanelsProps) {
    return (<>
        <Panel
            icon={<ShieldCheck className='h-4 w-4' />}
            title='Launch report'
            subtitle={trustRelease ? 'Recovery, export, and release details for this project.' : 'Report details appear after the first recorded launch.'}
        >
            {trustRelease && trust ? (
                <>
                    <div className='rounded-lg bg-ui-success/8 px-3 py-2 text-xs text-ui-success outline outline-ui-success/40'>
                        {trust.noLockIn.headline}
                    </div>
                    <TrustItem icon={<History className='h-3.5 w-3.5' />} label='Version history' value={trust.versionHistory.summary} />
                    <TrustItem icon={<RefreshCcw className='h-3.5 w-3.5' />} label='Rollback' value={trust.recovery.rollbackLabel} />
                    <TrustItem icon={<Archive className='h-3.5 w-3.5' />} label='Backup before risk' value={trust.recovery.backupBeforeRiskyChanges ? trust.recovery.backupPolicy : 'No backup policy recorded.'} />
                    <TrustItem icon={<Download className='h-3.5 w-3.5' />} label='Export' value={`${trust.exports.zipLabel} ${trust.exports.githubLabel}`} />
                    <TrustItem icon={<FileText className='h-3.5 w-3.5' />} label='Launch report' value={launchReport.join(' ')} />
                    <div className='flex flex-wrap gap-2'>
                        <a
                            href={supportBundleHref(trustRelease)}
                            target='_blank'
                            rel='noopener noreferrer'
                            className='inline-flex items-center gap-2 rounded-lg bg-ui-panel px-2.5 py-1.5 text-xs text-ui-text outline outline-ui-border transition-colors hover:text-ui-primary'
                        >
                            <LifeBuoy className='h-3.5 w-3.5' />
                            Support bundle
                        </a>
                        {trustRelease.status !== 'current' && trustRelease.status !== 'rollback_target' ? (
                            <ReleaseRollbackButton
                                releaseId={trustRelease.id}
                                pendingReleaseId={rollbackPendingId}
                                onRollback={onRollbackRelease}
                                label='Rollback'
                                className='inline-flex items-center gap-2 rounded-lg bg-ui-panel px-2.5 py-1.5 text-xs text-ui-text outline outline-ui-border transition-colors hover:text-ui-primary disabled:opacity-60'
                                showIcon
                            />
                        ) : null}
                    </div>
                    <div className='space-y-1'>
                        {trust.sla.slice(0, 4).map((item) => (
                            <div key={item.tier} className='rounded-lg bg-ui-raised px-3 py-2 text-xs text-ui-muted outline outline-ui-border'>
                                <span className='font-semibold text-ui-text'>{item.tier}:</span> {item.promise}
                            </div>
                        ))}
                    </div>
                </>
            ) : (
                <Empty text='No launch report yet. Record a launch to create rollback, export, and support details.' />
            )}
        </Panel>

        <Panel
            icon={<RefreshCcw className='h-4 w-4' />}
            title='Launch history'
            subtitle='Rollback targets and launch details.'
        >
            {releases.length ? (
                <div className='max-h-52 space-y-2 overflow-y-auto pr-1'>
                    {releases.slice(0, 6).map((release) => (
                        <div key={release.id} className='rounded-lg bg-ui-raised px-3 py-3 outline outline-ui-border'>
                            <div className='flex items-start justify-between gap-3'>
                                <div className='min-w-0'>
                                    <div className='truncate text-sm font-medium text-ui-text'>{release.vmName}</div>
                                    <div className='mt-1 text-xs text-ui-muted'>
                                        {release.stackType.replaceAll('_', ' ')} · {release.accessPolicy.replaceAll('_', ' ')}
                                    </div>
                                    <PreviewLink href={release.previewUrl} emptyText='No preview URL recorded' />
                                </div>
                                <WorkspaceStatusBadge tone={release.status === 'current' ? 'success' : release.status === 'rollback_target' ? 'warning' : 'muted'}>
                                    {release.status.replaceAll('_', ' ')}
                                </WorkspaceStatusBadge>
                            </div>
                            {release.notes ? <div className='mt-2 text-xs text-ui-muted'>{release.notes}</div> : null}
                            {release.trust ? (
                                <div className='mt-2 grid gap-1 text-[11px] text-ui-muted'>
                                    <span>{release.trust.noLockIn.headline}</span>
                                    <span>Support bundle: {release.trust.supportBundle.includes.join(', ')}</span>
                                </div>
                            ) : null}
                            {release.status !== 'rollback_target' && release.status !== 'current' ? (
                                <ReleaseRollbackButton
                                    releaseId={release.id}
                                    pendingReleaseId={rollbackPendingId}
                                    onRollback={onRollbackRelease}
                                    label='Rollback to this release'
                                    className='mt-3 rounded-lg bg-ui-panel px-2.5 py-1.5 text-xs text-ui-text outline outline-ui-border transition-colors hover:text-ui-primary disabled:opacity-60'
                                />
                            ) : null}
                        </div>
                    ))}
                </div>
            ) : <Empty text='No launch history yet. Run a check to start tracking attempts.' />}
        </Panel>

    </>)
}

function ReleaseRollbackButton({
    releaseId,
    pendingReleaseId,
    onRollback,
    label,
    className,
    showIcon = false,
}: {
    releaseId: string
    pendingReleaseId: string | null
    onRollback: (releaseId: string) => void | Promise<void>
    label: string
    className: string
    showIcon?: boolean
}) {
    const isPending = pendingReleaseId === releaseId

    return (
        <button
            type='button'
            onClick={() => void onRollback(releaseId)}
            disabled={isPending}
            className={className}
        >
            {showIcon ? <RefreshCcw className='h-3.5 w-3.5' /> : null}
            {isPending ? 'Preparing...' : label}
        </button>
    )
}
