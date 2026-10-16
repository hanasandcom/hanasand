import type { Dispatch, SetStateAction, KeyboardEvent } from 'react'
import type { QueueFilter, WorkbenchCase } from '../types'
import { Search, Filter } from 'lucide-react'
import { label, severityClass, relativeTime } from './presentation'

export function WorkbenchQueuePanel({ cases, selected, compact, query, setQuery, filter, setFilter, setSelectedId, onKeyDown }: {
    cases: WorkbenchCase[]
    selected?: WorkbenchCase
    compact: boolean
    query: string
    setQuery: Dispatch<SetStateAction<string>>
    filter: QueueFilter
    setFilter: Dispatch<SetStateAction<QueueFilter>>
    setSelectedId: Dispatch<SetStateAction<string>>
    onKeyDown: (event: KeyboardEvent<HTMLButtonElement>, index: number) => void
}) {
    return (
                    <aside className='min-w-0 border-b border-ui-border bg-ui-canvas xl:border-b-0 xl:border-r'>
                        <div className='grid gap-3 border-b border-ui-border p-4'>
                            <div>
                                <h2 className='text-sm font-semibold text-ui-text'>Attack queue</h2>
                                <p className='mt-0.5 text-xs text-ui-muted'>{cases.length} matching items</p>
                            </div>
                            <label className='relative block'>
                                <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ui-muted' />
                                <input
                                    value={query}
                                    onChange={event => setQuery(event.target.value)}
                                    placeholder='Search cases, actors, domains'
                                    className='h-10 w-full rounded-lg border border-ui-border bg-ui-canvas pl-9 pr-3 text-sm text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20'
                                />
                            </label>
                            <div className='flex flex-wrap gap-2'>
                                {(['all', 'critical', 'high', 'persistent', 'evidence'] as QueueFilter[]).map(item => (
                                    <button
                                        key={item}
                                        type='button'
                                        onClick={() => setFilter(item)}
                                        className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition ${filter === item ? 'border-ui-primary/35 bg-ui-primary/10 text-ui-on-primary' : 'border-ui-border bg-ui-raised text-ui-muted hover:border-ui-border hover:bg-ui-primary/10'}`}
                                    >
                                        {item === 'all' ? <Filter className='h-3.5 w-3.5' /> : null}
                                        {label(item)}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className={`${compact ? 'xl:max-h-[calc(100vh-250px)]' : 'xl:max-h-[620px]'} overflow-visible p-2 xl:overflow-auto`}>
                            <div role='listbox' aria-label='Analyst case list' className='grid gap-1'>
                                {cases.map((item, index) => (
                                    <button
                                        key={item.id}
                                        type='button'
                                        role='option'
                                        aria-selected={selected?.id === item.id}
                                        data-queue-case-id={item.id}
                                        data-queue-index={index}
                                        onClick={() => setSelectedId(item.id)}
                                        onKeyDown={event => handleQueueKeyDown(event, index)}
                                        className={`w-full min-w-0 rounded-lg border p-3 text-left transition ${selected?.id === item.id ? 'border-ui-primary/35 bg-ui-panel shadow-sm shadow-ui-canvas/20' : 'border-transparent bg-ui-raised hover:border-ui-border hover:bg-ui-panel'}`}
                                    >
                                        <div className='flex items-center justify-between gap-2'>
                                            <span className='truncate text-sm font-semibold text-ui-text'>{item.title}</span>
                                            <span className={severityClass(item.severity)}>{item.severity}</span>
                                        </div>
                                        <p className='mt-1 truncate text-xs text-ui-muted'>{item.company || item.matchedTerm} · {relativeTime(item.updatedAt)}</p>
                                        <p className='mt-2 line-clamp-2 wrap-break-word text-xs leading-5 text-ui-muted'>{item.subtitle}</p>
                                        <div className='mt-3 flex flex-wrap gap-2 text-[11px] font-semibold text-ui-muted'>
                                            <span className='rounded-full border border-ui-border bg-ui-canvas px-2 py-0.5 text-ui-muted'>{label(item.status)}</span>
                                            <span>{evidenceStrengthLabel(item.confidence)} evidence</span>
                                            <span>{relativeTime(item.updatedAt)}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                            {!cases.length && <p className='rounded-lg border border-dashed border-ui-border bg-ui-raised p-4 text-sm text-ui-muted'>Case state is updating for this filter.</p>}
                        </div>
                    </aside>
    )
}
