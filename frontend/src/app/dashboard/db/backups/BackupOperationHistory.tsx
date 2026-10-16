import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import type { BackupOperation } from '@/utils/db/internal'
import formatUtcDateTime from '@/utils/date/formatUtcDateTime'
import { backupErrorMessage, BackupStatus, formatDuration, operationLabel, stageLabel } from './backupPresentation'

export function BackupOperationHistory({ operations }: { operations: BackupOperation[] }) {
    const [expanded, setExpanded] = useState(false)

    return (
        <section className='overflow-hidden rounded-xl border border-ui-border bg-ui-panel' aria-labelledby='backup-history-heading'>
            <h2 id='backup-history-heading' className='m-0 border-b border-ui-border'>
                <button
                    type='button'
                    onClick={() => setExpanded(value => !value)}
                    aria-expanded={expanded}
                    aria-controls='backup-history-content'
                    aria-label={expanded ? 'Collapse history' : 'Expand history'}
                    className='flex min-h-14 w-full items-center justify-between gap-3 p-4 text-left text-ui-text hover:bg-ui-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ui-primary sm:px-5'
                >
                    <span className='font-semibold'>History</span>
                    <ChevronDown aria-hidden='true' className={`h-4 w-4 text-ui-muted transition-transform ${expanded ? 'rotate-180' : ''}`} />
                </button>
            </h2>
            <div id='backup-history-content' hidden={!expanded} className='overflow-x-auto'>
                <table className='min-w-[760px] w-full text-left text-sm'>
                    <thead className='bg-ui-raised text-xs uppercase text-ui-muted'>
                        <tr>
                            <th className='px-4 py-3'>Started</th>
                            <th className='px-4 py-3'>Operation</th>
                            <th className='px-4 py-3'>Status</th>
                            <th className='px-4 py-3'>Duration</th>
                            <th className='px-4 py-3'>Evidence</th>
                        </tr>
                    </thead>
                    <tbody className='divide-y divide-ui-border'>
                        {operations.map(operation => (
                            <tr key={operation.id} className='text-ui-text'>
                                <td className='px-4 py-3'>{formatUtcDateTime(operation.startedAt, 'Unknown')}</td>
                                <td className='px-4 py-3'>{operationLabel(operation)}</td>
                                <td className='px-4 py-3'><BackupStatus value={operation.status} /></td>
                                <td className='px-4 py-3'>{formatDuration(operation.durationMs)}</td>
                                <td className='max-w-md px-4 py-3 text-ui-muted'>
                                    {backupErrorMessage(operation.error) || operation.file || stageLabel(operation.stage)}
                                </td>
                            </tr>
                        ))}
                        {!operations.length && (
                            <tr>
                                <td colSpan={5} className='px-4 py-8 text-center text-ui-muted'>
                                    No operation has been attempted yet.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </section>
    )
}
