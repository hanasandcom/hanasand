import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import RecentScans from '@/components/test/recentScans'
import { DashboardPanel } from 'hanasand/dashboard'

type Props = {
    historyView: 'mine' | 'global'
    onHistoryViewChange: (view: 'mine' | 'global') => void
    scans: Test[]
}

export function LoadTestHistory({ historyView, onHistoryViewChange, scans }: Props) {
    const mine = historyView === 'mine'

    return <DashboardPanel className='overflow-hidden rounded-lg border-ui-border bg-ui-panel p-0 shadow-sm'>
        <div className='flex flex-wrap items-center justify-between gap-3 border-b border-ui-border bg-ui-raised px-4 py-3'>
            <div>
                <h2 className='text-base font-semibold text-ui-text'>Result history</h2>
                <p className='mt-1 text-sm text-ui-subtle'>Open a run to inspect the full evidence report.</p>
            </div>
            <div className='flex flex-wrap items-center gap-2'>
                <HistoryToggle value={historyView} onChange={onHistoryViewChange} />
                <Link
                    href='/test/stats'
                    className='inline-flex h-9 items-center gap-2 rounded-lg border border-ui-border bg-ui-panel px-3 text-sm font-semibold text-ui-text transition hover:border-ui-primary hover:bg-ui-raised'
                >
                    Results
                    <ArrowRight className='h-4 w-4' />
                </Link>
            </div>
        </div>
        <div className='p-3'>
            <RecentScans
                title={mine ? 'My endpoint checks' : 'Global endpoint checks'}
                readyMessage={mine ? 'Personal checks are ready.' : 'Global check state is updating.'}
                scans={scans}
                mine={mine}
                surface='premium'
                className='min-h-[22rem] shadow-none'
                listClassName='max-h-[24rem]'
            />
        </div>
    </DashboardPanel>
}

function HistoryToggle({ value, onChange }: { value: Props['historyView'], onChange: Props['onHistoryViewChange'] }) {
    return <div className='inline-flex rounded-lg border border-ui-border bg-ui-panel p-1' role='group' aria-label='Choose result history'>
        {(['mine', 'global'] as const).map(view => <button
            key={view}
            type='button'
            onClick={() => onChange(view)}
            aria-pressed={value === view}
            className={`h-8 rounded-md px-3 text-xs font-semibold transition ${value === view ? 'bg-ui-primary text-ui-on-primary' : 'text-ui-muted hover:bg-ui-raised'}`}
        >
            {view === 'mine' ? 'My checks' : 'Global'}
        </button>)}
    </div>
}
