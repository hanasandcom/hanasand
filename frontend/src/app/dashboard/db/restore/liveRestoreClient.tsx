'use client'

import Link from 'next/link'
import { useState } from 'react'
import { DatabaseZap, TriangleAlert } from 'lucide-react'
import type { BackupFile, BackupService } from '@/utils/db/internal'
import formatUtcDateTime from '@/utils/date/formatUtcDateTime'
import DatabaseEvidence from '../DatabaseEvidence'
import { stageLabel } from '../backups/backupPresentation'
import { restoreLiveBackupAction } from '../actions'
import { RestoreFeedback } from './RestoreFeedback'
import { RestoreOperationProgress } from './RestoreOperationProgress'
import { useDatabaseOperationRefresh } from '../useDatabaseOperationRefresh'
import { useBackupOperationAction } from './useBackupOperationAction'

export default function LiveRestoreClient({ backups, service, file, loadError = '' }: { backups: BackupFile[], service?: BackupService, file: string, loadError?: string }) {
    const { isPending, message, error, result, run } = useBackupOperationAction()
    const [confirmation, setConfirmation] = useState('')
    const selected = backups.find(backup => backup.file === file)
    const activeOperation = service?.currentOperation || null
    const activeRestore = activeOperation?.kind === 'restore_live' ? activeOperation : null
    const targetDatabase = service?.database || ''
    const requiredConfirmation = targetDatabase ? `RESTORE ${targetDatabase}` : ''

    useDatabaseOperationRefresh(activeOperation, isPending)

    function runRestore() {
        if (!selected) return
        run(() => restoreLiveBackupAction(selected.file, confirmation))
    }

    const canRun = Boolean(selected && targetDatabase && confirmation === requiredConfirmation && !isPending && !activeOperation)
    const visibleError = error || loadError
    const visibleOperation = activeRestore || result

    return (
        <main className='grid w-full gap-4 px-2 py-4' data-live-restore-console>
            <section className='rounded-xl border border-ui-border bg-ui-panel p-4 sm:p-5'>
                <div className='flex items-center gap-2'>
                    <DatabaseZap className='h-5 w-5 text-ui-primary' />
                    <h1 className='text-xl font-semibold text-ui-text'>Restore live database</h1>
                </div>
                <p className='mt-2 text-sm text-ui-muted'>This replaces all data in {targetDatabase || 'the live database'} with the selected backup. Database requests may briefly fail while it switches.</p>
                <div className='mt-4 flex items-start gap-2 rounded-lg border border-ui-warning/30 bg-ui-warning/10 p-3 text-sm text-ui-warning'>
                    <TriangleAlert className='mt-0.5 h-4 w-4 shrink-0' />
                    <p>Choose the intended archive carefully. Type <code className='font-mono'>{requiredConfirmation || 'RESTORE database-name'}</code> to continue.</p>
                </div>
            </section>

            <section className='rounded-xl border border-ui-border bg-ui-panel p-4 sm:p-5' aria-labelledby='live-restore-controls-heading'>
                <div className='flex items-center justify-between gap-3'>
                    <h2 id='live-restore-controls-heading' className='font-semibold text-ui-text'>Restore target</h2>
                    <Link href='/db/backups' className='text-sm font-semibold text-ui-primary hover:underline'>Back to backups</Link>
                </div>
                {selected ? (
                    <dl className='mt-4 grid gap-3 rounded-lg border border-ui-border bg-ui-raised p-3 text-sm sm:grid-cols-2'>
                        <DatabaseEvidence layout='metadata' className='min-w-0' label='Database' value={targetDatabase || 'Unavailable'} />
                        <DatabaseEvidence layout='metadata' className='min-w-0' label='Backup archive' value={selected.file} mono />
                        <DatabaseEvidence layout='metadata' className='min-w-0' label='Created' value={formatUtcDateTime(selected.mtime, 'Unknown')} />
                        <DatabaseEvidence layout='metadata' className='min-w-0' label='Size' value={selected.size || 'Not reported'} />
                        <DatabaseEvidence layout='metadata' className='min-w-0' label='Checksum' value={selected.checksumSha256 || (selected.verified ? 'Verified' : 'Verified during restore')} mono />
                    </dl>
                ) : (
                    <p role='alert' className='mt-4 rounded-lg border border-ui-danger/30 bg-ui-raised/10 p-3 text-sm text-ui-text'>This backup archive is unavailable. Return to the backup list and select an available archive.</p>
                )}

                <label className='mt-4 grid gap-1.5 text-sm font-medium text-ui-text'>
                    Type <code className='font-mono text-ui-primary'>{requiredConfirmation || 'RESTORE database-name'}</code> to confirm
                    <input value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete='off' spellCheck={false} disabled={!targetDatabase} placeholder={requiredConfirmation || 'RESTORE database-name'} className='min-h-11 rounded-lg border border-ui-border bg-ui-raised px-3 font-mono text-sm disabled:opacity-50' />
                </label>

                <button type='button' onClick={runRestore} disabled={!canRun} className='mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-ui-danger px-4 text-sm font-semibold text-ui-canvas disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto' data-live-restore-action>
                    {activeRestore ? stageLabel(activeRestore.stage) : isPending ? 'Restoring database…' : 'Restore database'}
                </button>
                {visibleError && <RestoreFeedback message={visibleError} />}
                {message && <RestoreFeedback message={message} tone='success' />}
            </section>

            {visibleOperation && <RestoreOperationProgress
                operation={visibleOperation}
                title='Restore progress'
                stages={['verifying_archive', 'creating_restore_database', 'restoring', 'checking_integrity', 'switching_live_database', 'removing_previous_database']}
                stageGridClassName='mt-4 grid gap-2 text-sm sm:grid-cols-3 xl:grid-cols-6'
                successContent={operation => <>{operation.restoredIntegrity?.schemas || 0} schemas and {operation.restoredIntegrity?.tables || 0} tables restored into {operation.targetDatabase}.</>}
            />}
        </main>
    )
}
