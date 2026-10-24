import type { UvmRun } from '@/utils/monitoring/types'
import { formatDate, RunCard } from './uvmPanelHelpers'

export type UvmRunGroup = { key: string, target: string, engine: string, profile: string, runs: UvmRun[] }

export function groupUvmRuns(runs: UvmRun[]): UvmRunGroup[] {
    const groups = new Map<string, UvmRunGroup>()
    for (const run of runs) {
        const key = JSON.stringify([run.target, run.engine, run.profile])
        const group = groups.get(key) ?? { key, target: run.target, engine: run.engine, profile: run.profile, runs: [] }
        group.runs.push(run)
        groups.set(key, group)
    }
    return [...groups.values()].sort((left, right) =>
        Date.parse(right.runs[0]?.createdAt || '') - Date.parse(left.runs[0]?.createdAt || '')
        || left.target.localeCompare(right.target) || left.engine.localeCompare(right.engine))
}

export function UvmRunGroupCard({ group, selectedRun, busy, onCancel, open }: {
    group: UvmRunGroup
    selectedRun: UvmRun | null
    busy: string
    onCancel: (run: UvmRun) => void
    open: boolean
}) {
    const latest = group.runs[0]
    return <article className='rounded-md border border-ui-border bg-ui-raised p-3'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
            <div><strong>{group.target}</strong><p className='mt-1 text-xs text-ui-muted'>{group.engine} · {group.profile} · {group.runs.length} matching loaded run{group.runs.length === 1 ? '' : 's'}</p></div>
            <span className='text-xs text-ui-muted'>Latest matching run · {latest.status} · {formatDate(latest.createdAt)}</span>
        </div>
        <details className='mt-2 border-t border-ui-border pt-2' open={open}>
            <summary className='cursor-pointer text-xs font-semibold'>View individual runs</summary>
            <div className='mt-2 grid gap-2'>{group.runs.map(run => <RunCard key={`${run.engine}:${run.id}`} run={run} defaultOpen={run.id === selectedRun?.id && run.engine === selectedRun?.engine} cancelBusy={busy === `run:${run.id}`} onCancel={() => onCancel(run)} />)}</div>
        </details>
    </article>
}
