import type { ReactNode } from 'react'
import type { BackupOperation } from '@/utils/db/internal'
import { stageLabel } from '../backups/backupPresentation'

export function RestoreOperationProgress({ operation, title, stages, stageGridClassName, successContent }: {
    operation: BackupOperation
    title: string
    stages: readonly string[]
    stageGridClassName: string
    successContent: (operation: BackupOperation) => ReactNode
}) {
    return (
        <section className='rounded-xl border border-ui-border bg-ui-panel p-4 sm:p-5' aria-live='polite'>
            <div className='flex items-center justify-between gap-3'><h2 className='font-semibold text-ui-text'>{title}</h2><span className='capitalize text-ui-muted'>{operation.status}</span></div>
            <ol className={stageGridClassName}>
                {stages.map(stage => <li key={stage} className={`rounded-lg border p-2 ${operation.stage === stage ? 'border-ui-primary bg-ui-primary/10 text-ui-primary' : 'border-ui-border text-ui-muted'}`}>{stageLabel(stage)}</li>)}
            </ol>
            {operation.status === 'succeeded' && <p className='mt-4 text-sm text-ui-success'>{successContent(operation)}</p>}
            {operation.error && <p className='mt-4 text-sm text-ui-text'>{operation.error}</p>}
        </section>
    )
}
