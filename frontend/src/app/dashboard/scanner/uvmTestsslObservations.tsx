import type { UvmTestsslObservation } from '@/utils/monitoring/types'

export function TestsslObservationList({ observations }: { observations?: UvmTestsslObservation[] }) {
    if (!observations?.length) return null
    return <div className='mt-3 grid gap-2'>
        <h4 className='text-xs font-semibold'>TLS observations · {observations.length}</h4>
        {observations.map(observation => <article key={observation.id} className='rounded border border-ui-border bg-ui-panel p-2 text-xs'>
            <div className='flex flex-wrap items-center gap-2'>
                <strong>{observation.checkId || 'TLS check'}</strong>
                <span className={`rounded px-2 py-0.5 font-semibold ${observation.disposition === 'finding' ? 'bg-ui-warning/15 text-ui-warning' : 'bg-ui-raised text-ui-muted'}`}>
                    {observation.disposition === 'finding' ? observation.severity : observation.disposition}
                </span>
                <span className='text-ui-muted'>{observation.host}:{observation.port}</span>
            </div>
            <p className='mt-1 whitespace-pre-wrap wrap-break-word'>{observation.result}</p>
            {(observation.cve || observation.cwe || observation.evidence) && <details className='mt-1'>
                <summary className='cursor-pointer text-ui-muted'>Technical evidence</summary>
                {(observation.cve || observation.cwe) && <p className='mt-1 text-ui-muted'>{[observation.cve, observation.cwe].filter(Boolean).join(' · ')}</p>}
                {observation.evidence && <pre className='mt-1 whitespace-pre-wrap wrap-break-word text-ui-muted'>{observation.evidence}</pre>}
            </details>}
        </article>)}
    </div>
}
