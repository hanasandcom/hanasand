import type { RequestRun } from './newRequestTypes'
import { shortUrlLabel } from './requestPresentation'

type RequestRunHistoryProps = {
    runs: RequestRun[]
    activeRun: RequestRun | null
    onSelect: (id: string) => void
}

export default function RequestRunHistory({ runs, activeRun, onSelect }: RequestRunHistoryProps) {
    return <div className='flex max-w-full gap-1.5 overflow-x-auto rounded-lg border border-ui-border bg-ui-canvas/12 p-2'>
        {runs.length ? runs.map((run) => <button key={run.id} type='button' onClick={() => onSelect(run.id)} className={`grid w-40 shrink-0 gap-1 rounded-lg border px-2.5 py-2 text-left transition ${activeRun?.id === run.id ? 'border-ui-warning/35 bg-ui-warning/8' : 'border-ui-border/8 bg-ui-panel/3 hover:bg-ui-panel/6'}`}>
            <span className='flex min-w-0 items-center gap-2 text-[11px] text-ui-text/78'><span className='font-semibold'>{run.method}</span><span className='truncate' title={run.url}>{shortUrlLabel(run.url)}</span></span>
            <span className='truncate text-[10px] text-ui-text/45'>{run.loading ? 'Running' : run.response?.status || (run.response?.error ? 'Error' : 'Done')}</span>
        </button>) : <div className='rounded-lg border border-dashed border-ui-border px-3 py-2 text-xs text-ui-text/45'>Run a request to inspect the response.</div>}
    </div>
}
