import type { Dispatch, SetStateAction } from 'react'

export type UvmPanelView = 'overview' | 'assessments' | 'assets' | 'scanners' | 'runs' | 'findings'

export function UvmPanelNavigation({ view, setView, unavailable, servicesPaused, assessmentCount, findingCount }: {
    view: UvmPanelView
    setView: Dispatch<SetStateAction<UvmPanelView>>
    unavailable: boolean
    servicesPaused: boolean
    assessmentCount: number
    findingCount: number
}) {
    const views: Array<[UvmPanelView, string]> = [
        ['overview', 'Overview'], ['assessments', `Assessments (${unavailable ? '—' : assessmentCount})`],
        ['assets', 'Assets'], ['scanners', 'Scanners'], ['runs', 'Scan history'],
        ['findings', `Findings (${unavailable ? '—' : findingCount})`],
    ]

    return <>
        <header className='flex flex-wrap items-center justify-between gap-3'><h1 className='text-2xl font-semibold'>Security scanner</h1><button type='button' onClick={() => setView('assessments')} disabled={unavailable} className='rounded-md bg-ui-text px-4 py-2 text-sm font-semibold text-ui-canvas disabled:opacity-50'>New assessment</button></header>
        {unavailable && !servicesPaused && <p role='status' className='rounded-md border border-ui-warning/40 bg-ui-warning/10 px-3 py-2 text-sm text-ui-warning'>Scanner API offline.</p>}
        <nav aria-label='Vulnerability management views' className='flex flex-wrap gap-2 border-b border-ui-border pb-2'>{views.map(([id, label]) => <button key={id} type='button' onClick={() => setView(id)} aria-current={view === id ? 'page' : undefined} className={`rounded-md px-3 py-2 text-sm font-semibold ${view === id ? 'bg-ui-text text-ui-canvas' : 'text-ui-muted hover:bg-ui-raised hover:text-ui-text'}`}>{label}</button>)}</nav>
    </>
}
