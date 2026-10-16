import { Panel, Stat, Empty, PreviewLink, TrustItem, formatActivityTime, formatUsageKind, PathBadge, ChecklistItem } from './workbenchPaneDisplay'
import { useEffect, useState } from 'react'
import { ServerCog, ShieldCheck } from 'lucide-react'
import { buildDeployProfile, detectEnvPlaceholders } from './workbenchPaneDeployProfile'

export function WorkspaceDeployPanel({ availableVmTargets, activeRepo, activeConversation, deployQuota, deployPending, deployments, onStartDeployment }: { availableVmTargets: AgentVmTarget[], activeRepo: AIImportedRepo | null, activeConversation: AIConversation | null, deployQuota: AIDeployQuota | null, deployPending: boolean, deployments: AIDeployment[], onStartDeployment: (input: { vmName: string, port: string, healthPath: string, accessPolicy: AIDeploymentAccessPolicy, environment: AIDeploymentEnvironment }) => void | Promise<void> }) {
    const [deployVmName, setDeployVmName] = useState(availableVmTargets[0]?.name || '')
    const [deployPort, setDeployPort] = useState('3000')
    const [deployHealthPath, setDeployHealthPath] = useState('/')
    const [deployAccessPolicy, setDeployAccessPolicy] = useState<AIDeploymentAccessPolicy>('owner_only')
    const [deployEnvironment, setDeployEnvironment] = useState<AIDeploymentEnvironment>('staging')
    const envPlaceholders = detectEnvPlaceholders(activeRepo)
    const deployProfile = buildDeployProfile({ environment: deployEnvironment, vmName: deployVmName, port: deployPort, healthPath: deployHealthPath, accessPolicy: deployAccessPolicy, activeRepo, activeConversation, envPlaceholders })
    useEffect(() => {
        if (!activeRepo) return
        if (activeRepo.stackType === 'fastify_postgres' || activeRepo.stackType === 'fastify_worker_redis') {
            setDeployPort('3001')
            setDeployHealthPath('/ready')
            return
        }
        setDeployPort('3000')
        setDeployHealthPath('/')
    }, [activeRepo?.id, activeRepo?.stackType])
    return (<>
            <Panel
                icon={<ServerCog className='h-4 w-4' />}
                title='Launch check'
                subtitle='One-click preview path with recorded release details.'
            >
                <div className='grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-2'>
                    {(['staging', 'production'] as AIDeploymentEnvironment[]).map((environment) => (
                        <button
                            key={environment}
                            type='button'
                            onClick={() => setDeployEnvironment(environment)}
                            className={`rounded-lg px-3 py-2 text-sm font-semibold outline transition-colors ${deployEnvironment === environment ? 'bg-ui-primary/12 text-ui-primary outline-ui-primary/20' : 'bg-ui-raised text-ui-muted outline-ui-border hover:text-ui-text'}`}
                        >
                            {environment === 'production' ? 'Production' : 'Staging'}
                        </button>
                    ))}
                </div>
                <div className='min-w-0 overflow-hidden rounded-lg bg-ui-raised px-3 py-3 text-xs text-ui-muted outline outline-ui-border'>
                    <div className='flex min-w-0 items-center gap-2 text-ui-text'>
                        <ShieldCheck className='h-3.5 w-3.5 text-ui-primary' />
                        <span className='min-w-0 wrap-break-word font-semibold'>{deployProfile.title}</span>
                    </div>
                    <div className='mt-2 grid min-w-0 gap-1 wrap-break-word'>
                        <div>Domain: {deployProfile.domain}</div>
                        <div>SSL: {deployProfile.ssl}</div>
                        <div>Logs: {deployProfile.logs}</div>
                        <div>Rollback: {deployProfile.rollback}</div>
                    </div>
                </div>
                {availableVmTargets.length ? (
                    <div className='flex flex-wrap gap-2'>
                        {availableVmTargets.slice(0, 8).map((target) => (
                            <button
                                key={target.id}
                                type='button'
                                onClick={() => setDeployVmName(target.name)}
                                className={`rounded-full px-2.5 py-1 text-[11px] outline ${deployVmName === target.name ? 'bg-ui-primary/12 text-ui-primary outline-ui-primary/18' : 'bg-ui-raised text-ui-muted outline-ui-border hover:text-ui-text'}`}
                            >
                                {target.name}
                            </button>
                        ))}
                    </div>
                ) : null}
                <div className='grid grid-cols-[minmax(0,1fr)_5rem] gap-2'>
                    <input value={deployVmName} onChange={(event) => setDeployVmName(event.target.value)} placeholder='Launch target' className='min-w-0 rounded-lg bg-ui-panel px-3 py-2 text-sm text-ui-text outline outline-ui-border placeholder:text-ui-muted' />
                    <input value={deployPort} onChange={(event) => setDeployPort(event.target.value)} placeholder='3000' inputMode='numeric' className='min-w-0 rounded-lg bg-ui-panel px-3 py-2 text-sm text-ui-text outline outline-ui-border placeholder:text-ui-muted' />
                </div>
                <input value={deployHealthPath} onChange={(event) => setDeployHealthPath(event.target.value)} placeholder='/health or /' className='rounded-lg bg-ui-panel px-3 py-2 text-sm text-ui-text outline outline-ui-border placeholder:text-ui-muted' />
                <div className='rounded-lg bg-ui-raised px-3 py-3 outline outline-ui-border'>
                    <div className='mb-2 text-[10px] uppercase tracking-[0.18em] text-ui-muted'>Launch checklist</div>
                    <div className='grid gap-1.5'>
                        {deployProfile.checklist.map((item) => (
                            <ChecklistItem key={item.label} label={item.label} state={item.state} />
                        ))}
                    </div>
                </div>
                <div className='rounded-lg bg-ui-raised px-3 py-3 outline outline-ui-border'>
                    <div className='mb-2 text-[10px] uppercase tracking-[0.18em] text-ui-muted'>Env placeholders</div>
                    {envPlaceholders.length ? (
                        <div className='flex flex-wrap gap-1.5'>
                            {envPlaceholders.slice(0, 10).map((name) => (
                                <span key={name} className='rounded-full bg-ui-primary/10 px-2 py-1 text-[10px] text-ui-muted outline outline-ui-primary/20'>
                                    {name}=required
                                </span>
                            ))}
                            {envPlaceholders.length > 10 ? <span className='text-[10px] text-ui-muted'>+{envPlaceholders.length - 10} more</span> : null}
                        </div>
                    ) : (
                        <div className='text-xs text-ui-muted'>No required env vars detected from imported files. Secrets are never echoed here.</div>
                    )}
                </div>
                {activeRepo ? (
                    <div className='text-xs text-ui-muted'>
                        Suggested for {activeRepo.stackType.replaceAll('_', ' ')}: {activeRepo.stackType === 'nextjs_docker' ? '3000 and /' : '3001 and /ready'}.
                    </div>
                ) : null}
                <select value={deployAccessPolicy} onChange={(event) => setDeployAccessPolicy(event.target.value as AIDeploymentAccessPolicy)} className='rounded-lg bg-ui-panel px-3 py-2 text-sm text-ui-text outline outline-ui-border'>
                    <option value='owner_only'>Owner only preview</option>
                    <option value='collaborators'>Collaborators</option>
                    <option value='public_preview'>Public preview</option>
                </select>
                {deployQuota ? (
                    <div className='rounded-lg bg-ui-raised px-3 py-2 text-xs text-ui-muted outline outline-ui-border'>
                        <div>
                            Checks: {deployQuota.used}/{deployQuota.limit} in {deployQuota.windowMinutes} min. {deployQuota.remaining} left.
                        </div>
                        <div className='mt-1'>
                            Active previews: {deployQuota.activeRunning}/{deployQuota.maxRunning}. {deployQuota.runningRemaining} slots left.
                            {deployQuota.sharedAcrossCollaborators ? ' Shared quota.' : ''}
                        </div>
                    </div>
                ) : null}
                <button
                    type='button'
                    onClick={() => void onStartDeployment({ vmName: deployVmName, port: deployPort, healthPath: deployHealthPath, accessPolicy: deployAccessPolicy, environment: deployEnvironment })}
                    disabled={deployPending}
                    className='rounded-lg bg-ui-primary px-3 py-2 text-sm font-semibold text-ui-on-primary transition-opacity hover:opacity-90 disabled:opacity-60'
                >
                    {deployPending ? 'Checking launch target...' : 'Run launch check'}
                </button>
                {deployments.length ? (
                    <div className='max-h-48 space-y-2 overflow-y-auto pr-1'>
                        {deployments.slice(0, 5).map((deployment) => (
                            <div key={deployment.id} className='rounded-lg bg-ui-raised px-3 py-3 outline outline-ui-border'>
                                <div className='flex items-start justify-between gap-3'>
                                    <div className='min-w-0'>
                                        <div className='truncate text-sm font-medium text-ui-text'>{deployment.vmName}</div>
                                        <PreviewLink href={deployment.previewUrl || deployment.healthcheckUrl} emptyText='No preview URL yet' />
                                        <div className='mt-1 text-[11px] text-ui-muted'>
                                            {deployment.accessPolicy.replaceAll('_', ' ')} · {deployment.stackType.replaceAll('_', ' ')}
                                        </div>
                                    </div>
                                    <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.16em] ${deployment.status === 'running' ? 'bg-ui-success/12 text-ui-success' : 'bg-ui-warning/12 text-ui-warning'}`}>
                                        {deployment.status}
                                    </span>
                                </div>
                                {deployment.failureReason ? (
                                    <div className='mt-2 rounded-lg bg-ui-warning/8 px-2.5 py-2 text-xs text-ui-warning outline outline-ui-warning/40'>
                                        {deployment.failureReason}
                                    </div>
                                ) : null}
                                <div className='mt-2 space-y-1'>
                                    {deployment.events.slice(-3).map((event) => (
                                        <div key={`${deployment.id}-${event.stage}-${event.timestamp}`} className='text-[11px] text-ui-muted'>
                                            {event.stage.replaceAll('_', ' ')} · {event.message}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : <Empty text='No launch attempts recorded for this conversation yet.' />}
            </Panel>

    </>)
}
