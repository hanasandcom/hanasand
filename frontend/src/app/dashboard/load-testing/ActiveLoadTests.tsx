import type { ReactNode } from 'react'
import Link from 'next/link'
import { DashboardTablePanel } from '@/components/dashboard/ui'
import type { Scenario } from './loadTestingScenarios'
import { latestP95 } from './loadTestingScenarios'

export function ActiveLoadTests({ scans, scenario }: { scans: Test[], scenario: Scenario }) {
    const queued = scans.filter(scan => scan.status.toLowerCase() === 'queued').length
    const running = scans.filter(scan => scan.status.toLowerCase() === 'running').length

    return <DashboardTablePanel
        panelClassName='overflow-hidden rounded-lg border-ui-border bg-ui-panel p-0 shadow-sm'
        tableHeadClassName='bg-ui-panel text-left text-xs font-semibold uppercase text-ui-muted'
        header={<div className='flex flex-wrap items-center justify-between gap-3 border-b border-ui-border bg-ui-raised px-4 py-3'>
            <div>
                <h2 className='text-base font-semibold text-ui-text'>Run management</h2>
                <p className='mt-1 text-sm text-ui-subtle'>Queued and running checks from the persisted load-test lane.</p>
            </div>
            <div className='flex flex-wrap gap-2 text-xs font-semibold text-ui-muted'>
                <CountBadge>{queued} queued</CountBadge>
                <CountBadge>{running} running</CountBadge>
                <CountBadge>{scenario.label} selected</CountBadge>
            </div>
        </div>}
        columnHeaders={<>
            <th className='px-4 py-3'>Status</th>
            <th className='px-4 py-3'>Target</th>
            <th className='px-4 py-3'>Queue</th>
            <th className='px-4 py-3'>p95</th>
            <th className='px-4 py-3 text-right'>Action</th>
        </>}
    >{scans.length ? scans.map(scan => <ActiveLoadTestRow key={scan.id} scan={scan} />) : (
            <tr>
                <td colSpan={5} className='px-4 py-8 text-center text-sm text-ui-muted'>No queued or running checks.</td>
            </tr>
        )}</DashboardTablePanel>
}

function CountBadge({ children }: { children: ReactNode }) {
    return <span className='rounded-md border border-ui-border bg-ui-panel px-2.5 py-1'>{children}</span>
}

function ActiveLoadTestRow({ scan }: { scan: Test }) {
    const p95 = latestP95(scan)
    const queue = scan.status.toLowerCase() === 'queued' ? `#${scan.queue_position || 1}` : 'running'

    return <tr className='hover:bg-ui-raised'>
        <td className='px-4 py-3 font-semibold text-ui-text'>{scan.status}</td>
        <td className='max-w-[28rem] truncate px-4 py-3 text-ui-muted'>{scan.url}</td>
        <td className='px-4 py-3 text-ui-muted'>{queue}</td>
        <td className='px-4 py-3 text-ui-muted'>{p95 ? `${p95}ms` : 'collecting'}</td>
        <td className='px-4 py-3 text-right'>
            <Link href={`/test/${scan.id}`} className='inline-flex h-8 items-center justify-center rounded-lg border border-ui-border bg-ui-raised px-3 text-xs font-semibold text-ui-text transition hover:border-ui-primary'>
                Open
            </Link>
        </td>
    </tr>
}
