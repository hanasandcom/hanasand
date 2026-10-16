'use client'

import { useEffect, useRef, useState } from 'react'
import { Clock3, Plus, PanelRightClose, PanelRightOpen } from 'lucide-react'
import type { AgentAutomation } from '@/utils/automations/client'
import SortIndicator from '@/components/dashboard/sort-indicator'
import CertificateStatus from './certificateStatus'
import { automationInputClass, formatAutomationDate } from './automationDraft'
import { healthCheckStatus, healthCheckTag, sortHealthChecks, type HealthSortKey } from './healthCheckSorting'

type Props = {
    automations: AgentAutomation[]
    mode: 'health' | 'cron'
    detailsOpen: boolean
    editing: boolean
    selectedId?: string
    onToggleDetails: () => void
    onCreate: () => void
    onSelect: (automation: AgentAutomation) => void
}

export default function AutomationListPanel({ automations, mode, detailsOpen, editing, selectedId, onToggleDetails, onCreate, onSelect }: Props) {
    const [sort, setSort] = useState<{ key: HealthSortKey, direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' })
    const [search, setSearch] = useState('')
    const [searchOpen, setSearchOpen] = useState(false)
    const searchInput = useRef<HTMLInputElement>(null)
    const searchButton = useRef<HTMLButtonElement>(null)

    useEffect(() => {
        if (searchOpen) searchInput.current?.focus()
        function onKeyDown(event: KeyboardEvent) {
            if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'j' || event.repeat) return
            event.preventDefault()
            if (searchOpen) closeSearch()
            else setSearchOpen(true)
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [searchOpen])

    function closeSearch() {
        setSearchOpen(false)
        setSearch('')
        searchButton.current?.focus()
    }

    const filteredAutomations = sortHealthChecks(automations, sort.key, sort.direction)
        .filter(automation => !search.trim() || [automation.name, ...(automation.caseNumbers || [])]
            .some(value => value.toLowerCase().includes(search.trim().toLowerCase())))

    return <>
        <section className='rounded-xl border border-ui-border bg-ui-panel shadow-sm'>
            <div className='flex flex-wrap items-center justify-between gap-3 border-b border-ui-border p-4'>
                <div>
                    <h2 className='text-lg font-semibold text-ui-text'>{mode === 'cron' ? 'Personal' : 'Health checks'}</h2>
                    <p className='mt-1 text-sm text-ui-muted'>{automations.length} {mode === 'cron' ? `job${automations.length === 1 ? '' : 's'}` : `check${automations.length === 1 ? '' : 's'}`}</p>
                </div>
                <button type='button' aria-label={detailsOpen ? 'Collapse check details' : 'Expand check details'} title={detailsOpen ? 'Collapse check details' : 'Expand check details'} aria-expanded={detailsOpen} aria-controls='health-check-details' onClick={onToggleDetails} className='ml-auto inline-flex h-9 w-9 shrink-0 items-center justify-center rounded p-0 text-ui-muted hover:bg-ui-raised focus-visible:outline-2 focus-visible:outline-ui-primary'>
                    {detailsOpen ? <PanelRightClose className='h-5 w-5' /> : <PanelRightOpen className='h-5 w-5' />}
                </button>
                <div className='flex w-fit max-w-full shrink-0 flex-nowrap items-center gap-2'>
                    {searchOpen && <input ref={searchInput} id='health-check-search' aria-label='Find a case or monitor' className={`${automationInputClass} min-w-0 max-w-56 basis-24 flex-none sm:basis-56`} type='search' placeholder='HA-123 or monitor name' value={search} onChange={event => setSearch(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); closeSearch() } }} />}
                    <button ref={searchButton} type='button' aria-label='Find a case or monitor (Cmd J)' aria-keyshortcuts='Meta+J Control+J' aria-expanded={searchOpen} aria-controls='health-check-search' title='Find a case or monitor (Cmd J)' onClick={() => searchOpen ? closeSearch() : setSearchOpen(true)} className='inline-flex h-9 shrink-0 items-center rounded-md border border-ui-border bg-ui-panel px-3 text-sm font-semibold text-ui-muted hover:text-ui-text focus-visible:outline-2 focus-visible:outline-ui-primary'>Cmd J</button>
                    {!editing && <button type='button' onClick={onCreate} className='inline-flex h-9 shrink-0 items-center gap-2 rounded-lg bg-ui-primary px-2.5 text-sm font-semibold text-ui-on-primary hover:opacity-90'><Plus className='h-4 w-4' />Create automation</button>}
                </div>
            </div>
            <div className='flex gap-3 overflow-x-auto border-b border-ui-border px-4 py-2 text-xs text-ui-muted md:grid md:grid-cols-[minmax(9rem,1.3fr)_minmax(7rem,0.8fr)_minmax(6rem,0.7fr)_minmax(8rem,1fr)_minmax(5rem,0.6fr)_minmax(5rem,0.6fr)]'>
                {(['name', 'status', 'cert', 'history', 'uptime', 'tags'] as const).map(key => {
                    const label = key[0].toUpperCase() + key.slice(1)
                    const active = sort.key === key
                    return <button key={key} type='button' aria-label={`Sort by ${label}`} aria-pressed={active} title={`${label}${key === 'history' ? ' (unhealthy recent checks)' : ''}: sort ${active && sort.direction === 'asc' ? 'descending' : 'ascending'}`} onClick={() => setSort({ key, direction: active && sort.direction === 'asc' ? 'desc' : 'asc' })} className={`inline-flex shrink-0 items-center gap-1 rounded py-1 text-left hover:text-ui-text focus-visible:outline-2 focus-visible:outline-ui-primary ${active ? 'font-semibold text-ui-text' : ''}`}>
                        {label}<SortIndicator active={active} direction={sort.direction} />
                    </button>
                })}
            </div>
            <span className='sr-only' role='status'>Sorted by {sort.key}, {sort.direction === 'asc' ? 'ascending' : 'descending'}.</span>
            <div className='divide-y divide-ui-border'>
                {filteredAutomations.map(automation => <AutomationRow key={automation.id} automation={automation} selected={selectedId === automation.id} onClick={() => onSelect(automation)} />)}
            </div>
        </section>
    </>
}

export function StatusSummary({ automations }: { automations: AgentAutomation[] }) {
    const counts = automations.reduce((result, automation) => {
        const key = automation.status === 'paused' || automation.expectedDown || automation.upsideDown
            ? 'maintenance'
            : !automation.lastStatus || automation.lastStatus === 'running'
                ? 'pending'
                : automation.lastStatus === 'failed'
                    ? 'down'
                    : automation.lastStatus === 'warning' ? 'warning' : 'up'
        result[key] += 1
        return result
    }, { up: 0, down: 0, maintenance: 0, pending: 0, warning: 0 })

    return <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-5'>
        {(['up', 'down', 'maintenance', 'pending', 'warning'] as const).map(key => <div key={key} className='rounded-xl border border-ui-border bg-ui-panel px-4 py-3'>
            <div className='flex items-center gap-2 text-sm text-ui-muted'>
                <span className={`h-2.5 w-2.5 rounded-full ${key === 'up' ? 'bg-ui-success' : key === 'down' ? 'bg-ui-raised' : key === 'maintenance' ? 'bg-ui-primary' : 'bg-ui-warning'}`} />
                {key[0].toUpperCase() + key.slice(1)}
            </div>
            <p className='mt-2 text-2xl font-semibold text-ui-text'>{counts[key]}</p>
        </div>)}
    </div>
}

export function WelcomeState({ onCreate, compact = false }: { onCreate: () => void, compact?: boolean }) {
    if (compact) return <div className='grid min-h-72 place-items-center text-center'><div>
        <Clock3 className='mx-auto h-8 w-8 text-ui-primary' />
        <h2 className='mt-3 text-lg font-semibold text-ui-text'>Nothing selected</h2>
        <p className='mt-1 text-sm text-ui-muted'>Choose an automation to see its latest checks.</p>
    </div></div>

    return <section className='relative isolate grid min-h-[40rem] overflow-hidden px-4 py-10 text-center sm:px-8'>
        <svg viewBox='0 0 1000 700' preserveAspectRatio='none' aria-hidden='true' className='absolute left-1/2 top-4 z-0 h-[calc(100%-2rem)] w-[min(80%,96rem)] -translate-x-1/2'>
            <defs><clipPath id='automation-cloud-shape'><path d='M80 600C48 574 43 523 61 477C79 431 121 409 171 414C182 358 220 310 276 293C315 281 350 288 378 305C392 248 439 201 501 190C558 180 608 198 642 232C683 200 741 183 796 199C858 217 893 260 901 309C945 318 972 353 968 397C1002 421 1005 467 983 504C1002 546 977 596 931 616C861 647 778 629 724 638C670 648 625 638 573 648C515 661 455 645 414 635C350 650 292 641 255 628C201 639 131 632 80 600Z' /></clipPath></defs>
            <path fill='var(--automation-cloud)' fillOpacity='0.76' d='M80 600C48 574 43 523 61 477C79 431 121 409 171 414C182 358 220 310 276 293C315 281 350 288 378 305C392 248 439 201 501 190C558 180 608 198 642 232C683 200 741 183 796 199C858 217 893 260 901 309C945 318 972 353 968 397C1002 421 1005 467 983 504C1002 546 977 596 931 616C861 647 778 629 724 638C670 648 625 638 573 648C515 661 455 645 414 635C350 650 292 641 255 628C201 639 131 632 80 600Z' />
            <path fill='var(--automation-cloud-detail)' fillOpacity='0.34' clipPath='url(#automation-cloud-shape)' d='M25 480C82 445 143 443 191 461C242 481 284 472 325 451C366 430 408 438 443 464C470 485 486 508 500 529C484 551 463 571 437 582C392 601 362 589 322 601C278 614 237 596 196 603C144 612 94 600 55 578C28 563 14 526 25 480Z' />
            <path fill='var(--automation-cloud-detail)' fillOpacity='0.25' clipPath='url(#automation-cloud-shape)' d='M613 300C650 276 694 274 731 292C764 308 788 337 792 370C765 382 736 382 710 370C678 355 647 355 620 365C604 343 601 321 613 300Z' />
            <path fill='var(--automation-cloud-detail)' fillOpacity='0.22' clipPath='url(#automation-cloud-shape)' d='M350 568C388 548 424 548 458 564C488 578 519 579 547 565C572 553 601 557 623 575C602 602 572 616 536 616C502 616 474 605 443 614C408 625 375 612 350 592C340 584 340 576 350 568Z' />
        </svg>
        <div className='relative z-10 mx-auto flex max-w-2xl flex-col items-center justify-center'>
            <div className='relative mb-3 h-72 w-[min(32rem,92%)]'><img src='/images/empty-states/automations-barn-draft.png' alt='A simple open barn with an empty interior' className='relative z-10 h-full w-full object-contain' /></div>
            <h2 className='text-3xl font-semibold text-ui-text'>Create automation</h2>
            <p className='mx-auto mt-3 max-w-lg text-base leading-7 text-ui-muted'>Check that everything is working as it should, and get alerted if something is wrong.</p>
            <button type='button' onClick={onCreate} className='mt-7 inline-flex h-11 min-w-32 items-center justify-center gap-2 rounded-lg bg-ui-primary px-5 text-sm font-semibold text-ui-on-primary shadow-lg hover:opacity-90'><Plus className='h-4 w-4' />Create</button>
        </div>
    </section>
}

export function AutomationRow({ automation, selected, onClick }: { automation: AgentAutomation, selected: boolean, onClick: () => void }) {
    const missingUrl = automation.actionType === 'agent_prompt' && !automation.targetUrl
    const failed = Boolean(automation.consecutiveFailures || automation.lastStatus === 'failed' || missingUrl)
    const warning = automation.lastStatus === 'warning'
    const state = healthCheckStatus(automation)
    return <div data-health-check={automation.id} className={`relative grid [&>span]:pointer-events-none w-full grid-cols-2 items-center gap-3 border-t border-ui-border px-4 py-3 text-left transition hover:bg-ui-raised md:grid-cols-[minmax(9rem,1.3fr)_minmax(7rem,0.8fr)_minmax(6rem,0.7fr)_minmax(8rem,1fr)_minmax(5rem,0.6fr)_minmax(5rem,0.6fr)] ${selected ? 'bg-ui-primary/5' : ''}`}>
        <button type='button' onClick={onClick} aria-label={automation.name} className='absolute inset-0 rounded focus-visible:outline-2 focus-visible:outline-ui-primary' />
        <span className='min-w-0 truncate text-sm font-semibold text-ui-text'>{automation.name}</span>
        <span className={`w-fit rounded-full px-2 py-1 text-xs font-semibold ${failed ? 'bg-ui-raised/10 text-ui-text' : warning ? 'bg-ui-warning/10 text-ui-warning' : automation.status === 'active' && (automation.monitoringType !== 'push' || automation.lastStatus) ? 'bg-ui-success/10 text-ui-success' : 'bg-ui-raised text-ui-muted'}`}>{state}</span>
        <CertificateStatus automation={automation} />
        <span className='flex items-center gap-1' aria-label='History'>{historyBars(automation)}</span>
        <span className='text-xs text-ui-muted'>{automation.uptime == null ? '—' : `${automation.uptime}%`}</span>
        <span className='text-xs text-ui-muted'>{healthCheckTag(automation)}</span>
    </div>
}

function historyBars(automation: AgentAutomation) {
    const history = automation.history || []
    if (!history.length) return <span className='text-xs text-ui-muted'>No checks</span>
    return <span className='flex gap-0.5'>{history.map(run => <span key={run.id} title={`${formatAutomationDate(run.started_at)}: ${run.warning ? 'warning' : run.status}`} className={`h-4 w-1 rounded-sm ${run.status === 'failed' ? 'bg-ui-danger' : run.warning ? 'bg-ui-warning' : run.status === 'completed' ? 'bg-ui-success' : 'bg-ui-muted/40'}`} />)}</span>
}
