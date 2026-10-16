import { containerHealth } from '../systemPresentation'

export function AIContainerHealth({ containers, error }: {
    containers: DockerContainer[]
    error: string | null
}) {
    return (
        <div className='rounded-lg border border-ui-border bg-ui-raised p-4' data-ai-container-health>
            {error ? <p className='mb-3 text-sm text-ui-text' role='alert'>{error}</p> : null}
            <div className='grid gap-2 md:grid-cols-2'>
                {containers.length ? containers.map(container => {
                    const health = containerHealth(container)
                    return (
                        <div
                            key={container.id}
                            className='min-w-0 rounded-md border border-ui-border bg-ui-panel px-3 py-2 text-xs'
                            data-ai-container-row
                        >
                            <div className='flex items-start justify-between gap-2'>
                                <div className='min-w-0'>
                                    <p className='truncate font-semibold text-ui-text'>{container.name}</p>
                                    <p className='mt-1 truncate text-ui-muted'>
                                        {container.image || container.name} · {container.status}
                                    </p>
                                </div>
                                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${healthToneClass(health.tone)}`}>
                                    {health.label}
                                </span>
                            </div>
                        </div>
                    )
                }) : <p className='text-sm text-ui-muted'>AI container rows appear as Docker telemetry attaches.</p>}
            </div>
        </div>
    )
}

export function logContainerFrom(containers: DockerContainer[]) {
    return containers.find(container => {
        const tone = containerHealth(container).tone
        return tone === 'bad' || tone === 'warn'
    }) || containers[0]
}

function healthToneClass(tone: ReturnType<typeof containerHealth>['tone']) {
    if (tone === 'ok') return 'border-ui-success/30 bg-ui-success/10 text-ui-success'
    if (tone === 'warn') return 'border-ui-warning/30 bg-ui-warning/10 text-ui-warning'
    if (tone === 'bad') return 'border-ui-danger/30 bg-ui-raised/10 text-ui-text'
    return 'border-ui-border bg-ui-raised text-ui-muted'
}
