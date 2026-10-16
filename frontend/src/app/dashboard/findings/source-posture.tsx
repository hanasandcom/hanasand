import type { DwmProductSnapshot } from '@/utils/dwm/product'
import type { OperationsSnapshot } from './types'
import { relativeTimeLabel, stateLabel } from './case-format'
import { SlidersHorizontal } from 'lucide-react'

const DWM_RECOVERY_PREVIEW_ROWS = 3

export function SourcePosture({ snapshot, operations }: { snapshot: DwmProductSnapshot, operations: OperationsSnapshot | null }) {
    const sourceRows = operations?.sourceHealth ?? []
    return (
        <section className='rounded-lg border border-ui-border bg-ui-panel'>
            <div className='flex items-center justify-between gap-3 border-b border-ui-border px-4 py-3'>
                <div>
                    <h3 className='text-sm font-semibold text-ui-text'>Source health</h3>
                    <p className='mt-0.5 text-xs text-ui-muted'>{operations ? `${operations.counts.activeSourceCount}/${operations.counts.sourceCount} active sources` : 'Source inventory'}</p>
                </div>
                <SlidersHorizontal className='h-4 w-4 text-ui-primary' />
            </div>
            <div className='p-3'>
                {sourceRows.length ? (
                    <div className='overflow-hidden rounded-lg border border-ui-border'>
                        <table className='w-full text-left text-xs'>
                            <thead className='bg-ui-raised text-[10px] uppercase text-ui-muted'>
                                <tr>
                                    <th className='px-3 py-2 font-semibold'>Source</th>
                                    <th className='px-3 py-2 font-semibold'>State</th>
                                    <th className='px-3 py-2 font-semibold'>Last pull</th>
                                </tr>
                            </thead>
                            <tbody className='divide-y divide-ui-border'>
                                {sourceRows.slice(0, DWM_RECOVERY_PREVIEW_ROWS).map(source => (
                                    <tr key={source.sourceId} className='bg-ui-panel align-top'>
                                        <td className='px-3 py-2'>
                                            <p className='max-w-37.5 truncate font-semibold text-ui-text' title={source.sourceName}>{source.sourceName}</p>
                                            <p className='mt-0.5 text-[11px] text-ui-muted'>{stateLabel(source.family)} · {source.approvedMetadataOnly ? 'redacted source' : 'message capture'}</p>
                                        </td>
                                        <td className='px-3 py-2'>
                                            <span className={source.status === 'active' ? 'rounded-full bg-ui-success/10 px-2 py-0.5 font-semibold text-ui-success' : 'rounded-full bg-ui-warning/10 px-2 py-0.5 font-semibold text-ui-warning'}>
                                                {stateLabel(source.status)}
                                            </span>
                                        </td>
                                        <td className='px-3 py-2 font-semibold text-ui-muted'>{source.lastCollectedAt ? relativeTimeLabel(source.lastCollectedAt) : 'never'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className='grid gap-2'>
                        {snapshot.sourceCoverage.map(source => (
                            <div key={source.family} className='rounded-lg border border-ui-border bg-ui-raised p-3'>
                                <div className='flex items-center justify-between gap-3'>
                                    <span className='text-sm font-semibold text-ui-text'>{source.label}</span>
                                    <span className='rounded-full bg-ui-panel px-2 py-0.5 text-[11px] font-semibold text-ui-muted'>{source.activeCount}/{source.sourceCount}</span>
                                </div>
                                <p className='mt-1 line-clamp-2 text-xs leading-5 text-ui-muted'>{source.detail}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </section>
    )
}
