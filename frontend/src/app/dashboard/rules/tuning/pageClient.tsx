'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw, SlidersHorizontal } from 'lucide-react'
import { DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import SortIndicator from '@/components/dashboard/sort-indicator'
import { useWorkspace } from '@/components/organizations/workspaceProvider'
import { requestJson, type Rule } from '../detection-rules'
import CreateRuleDialog from '../create-rule-dialog'
import ReprocessRule from '../reprocess-rule'
import type { Condition } from '../condition-builder'

type LogPattern = {
    message: string
    ip: string
    ip_path: string | null
    user_agent: string
    user_agent_path: string | null
    last_triggered: string | null
    last_24h_count: string
    event_count: string
    storage_bytes: string
}
export type TuningData = { organizationId: string, generatedAt: string | null, logs: LogPattern[], pending: boolean, refreshing: boolean }
type SortField = 'message' | 'ip' | 'user_agent' | 'event_count' | 'storage_bytes'
type SortDirection = 'asc' | 'desc'

const sortFields: { value: SortField, label: string }[] = [
    { value: 'message', label: 'Log' },
    { value: 'ip', label: 'IP' },
    { value: 'user_agent', label: 'User agent' },
    { value: 'event_count', label: 'Count' },
    { value: 'storage_bytes', label: 'Row data' },
]

const numberFormat = new Intl.NumberFormat('en')

function formatBytes(value: number) {
    if (value < 1024) return `${value} B`
    const units = ['KB', 'MB', 'GB', 'TB']
    let amount = value / 1024, unit = 0
    while (amount >= 1024 && unit < units.length - 1) { amount /= 1024; unit++ }
    return `${amount >= 10 ? Math.round(amount) : amount.toFixed(1)} ${units[unit]}`
}

function rulePreset(log: LogPattern) {
    const conditions: Condition[] = [{ path: 'message', operator: 'equals', value: log.message, caseSensitive: true }]
    const failedExecutable = /^failed exec: (\/\S+)$/.exec(log.message)?.[1]
    if (failedExecutable) conditions.push(
        { path: 'metadata.collector', operator: 'equals', value: 'auditd', caseSensitive: true },
        { path: 'event_type', operator: 'equals', value: 'process', caseSensitive: true },
        { path: 'action', operator: 'equals', value: 'exec', caseSensitive: true },
        { path: 'outcome', operator: 'equals', value: 'failure', caseSensitive: true },
        { path: 'process.executable', operator: 'equals', value: failedExecutable, caseSensitive: true },
    )
    if (log.ip_path && log.ip) conditions.push({ path: log.ip_path, operator: 'equals', value: log.ip, caseSensitive: true })
    if (log.user_agent_path && log.user_agent) conditions.push({ path: log.user_agent_path, operator: 'equals', value: log.user_agent, caseSensitive: true })
    return {
        name: `Suppress: ${log.message}`.slice(0, 120),
        explanation: failedExecutable
            ? 'Suppress this auditd failed-exec pattern for the attempted executable and retain only matching process-exec failures.'
            : 'Suppress this repeated stored log pattern using the message and available IP and user agent fields.',
        stage: 'analyze',
        action: 'drop',
        conditions,
    }
}

export default function TuningPage({ initialData = null, initialError = '' }: { initialData?: TuningData | null, initialError?: string }) {
    const { organizations } = useWorkspace()
    const [data, setData] = useState<TuningData | null>(initialData)
    const [selected, setSelected] = useState<LogPattern | null>(null)
    const [createdRule, setCreatedRule] = useState<Rule | null>(null)
    const [error, setError] = useState(initialError)
    const [pending, setPending] = useState(Boolean(initialData?.pending))
    const [cacheBuster, setCacheBuster] = useState(0)
    const [sortField, setSortField] = useState<SortField>('event_count')
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
    const canManage = organizations.some(organization => organization.id === data?.organizationId
        && ['owner', 'admin', 'editor'].includes(organization.role?.toLowerCase() || ''))

    const refresh = useCallback(async (signal?: AbortSignal, cache: RequestCache = 'default', version = cacheBuster) => {
        if (document.visibilityState !== 'visible') return
        try {
            const path = version ? `/api/backend/logs/tuning?refresh=${version}` : '/api/backend/logs/tuning'
            const payload = await requestJson<TuningData>(path, { cache, signal })
            if (!signal?.aborted) {
                setPending(Boolean(payload.pending))
                setData(payload)
                setError('')
            }
        } catch (cause) {
            if (!signal?.aborted) {
                setPending(false)
                setError(cause instanceof Error ? cause.message : 'Log patterns could not be loaded.')
            }
        }
    }, [cacheBuster])

    const requestRefresh = useCallback(async () => {
        try {
            await requestJson<{ refreshing: boolean }>('/api/backend/logs/tuning/refresh', { method: 'POST' })
            const version = Date.now()
            setCacheBuster(version)
            setError('')
            await refresh(undefined, 'no-store', version)
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'The background refresh could not be queued.')
        }
    }, [refresh])
    const completeReprocessing = useCallback(() => { void requestRefresh() }, [requestRefresh])

    useEffect(() => {
        const controller = new AbortController()
        if (!initialData) void refresh(controller.signal)
        const interval = window.setInterval(() => void refresh(), pending ? 15_000 : 10_000)
        const onVisible = () => { if (document.visibilityState === 'visible') void refresh() }
        document.addEventListener('visibilitychange', onVisible)
        return () => { controller.abort(); window.clearInterval(interval); document.removeEventListener('visibilitychange', onVisible) }
    }, [initialData, refresh, pending])

    const preset = useMemo(() => selected ? rulePreset(selected) : undefined, [selected])
    const displayedAt = data?.generatedAt ? new Date(data.generatedAt).toLocaleString() : ''
    const totalStorageBytes = useMemo(() => (data?.logs || []).reduce((total, log) => total + Number(log.storage_bytes || 0), 0), [data?.logs])
    const sortedLogs = useMemo(() => [...(data?.logs || [])].sort((a, b) => {
        const left = a[sortField], right = b[sortField]
        const compared = sortField === 'message' || sortField === 'ip' || sortField === 'user_agent'
            ? String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' })
            : Number(left) - Number(right)
        return sortDirection === 'asc' ? compared : -compared
    }), [data?.logs, sortDirection, sortField])
    const sortLabel = sortFields.find(field => field.value === sortField)?.label || 'Count'

    return <DashboardPage className='!gap-5 !px-2 !py-4'>
        <header className='flex flex-wrap items-center justify-between gap-3'>
            <div><h1 className='flex items-center gap-2 text-2xl font-semibold'><SlidersHorizontal size={22} aria-hidden />Log tuning</h1>
                <p className='mt-1 text-sm text-ui-muted'>The 100 largest stored log patterns, grouped by message, IP, and user agent. Counts are estimates and refresh about once a minute.</p></div>
            <button type='button' onClick={() => void requestRefresh()} className='inline-flex items-center gap-2 rounded-lg border border-ui-border px-3 py-2 text-sm'><RefreshCw size={15} aria-hidden />Refresh summary</button>
        </header>

        {error && <p role='alert' className='rounded-lg border border-ui-danger/40 bg-ui-danger/10 p-3 text-sm text-ui-danger'>{error}</p>}
        {createdRule && data && <ReprocessRule key={createdRule.id} rule={createdRule} organizationId={data.organizationId} disabled={!canManage} defaultRange='all' onComplete={completeReprocessing} />}

        <DashboardPanel className='min-w-0 overflow-hidden'>
            <div className='flex flex-wrap items-center justify-between gap-2 border-b border-ui-border px-4 py-3'>
                <h2 className='font-semibold'>Stored log patterns</h2>
                <div className='flex flex-wrap items-center justify-end gap-2'>
                    <p className='text-xs text-ui-muted'>{data?.refreshing ? `Refreshing in background${displayedAt ? ` · showing snapshot from ${displayedAt}` : ''}…` : displayedAt ? `Updated ${displayedAt}` : pending ? 'Preparing the summary in the background…' : 'Loading patterns…'}{data && <> · {formatBytes(totalStorageBytes)} total</>}</p>
                    <details className='relative'>
                        <summary className='flex cursor-pointer list-none items-center gap-1.5 rounded-lg border border-ui-border px-2.5 py-1.5 text-xs font-medium text-ui-text hover:bg-ui-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-ui-primary'><SlidersHorizontal size={14} aria-hidden />Filter</summary>
                        <div className='absolute right-0 z-10 mt-2 w-56 rounded-lg border border-ui-border bg-ui-panel p-3 shadow-lg'>
                            <label className='block text-xs font-medium text-ui-muted' htmlFor='tuning-sort-field'>Sort by</label>
                            <select id='tuning-sort-field' value={sortField} onChange={event => setSortField(event.target.value as SortField)} className='mt-1 w-full rounded-md border border-ui-border bg-ui-bg px-2 py-1.5 text-sm text-ui-text'>
                                {sortFields.map(field => <option key={field.value} value={field.value}>{field.label}</option>)}
                            </select>
                            <div className='mt-3 flex gap-2' role='group' aria-label={`Sort ${sortLabel}`}>
                                {(['asc', 'desc'] as const).map(direction => <button key={direction} type='button' aria-pressed={sortDirection === direction} onClick={() => setSortDirection(direction)} className='inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-ui-border px-2 py-1.5 text-xs hover:bg-ui-raised aria-pressed:border-ui-primary aria-pressed:text-ui-primary'>
                                    {direction === 'asc' ? 'Ascending' : 'Descending'}<SortIndicator active={sortDirection === direction} direction={direction} />
                                </button>)}
                            </div>
                        </div>
                    </details>
                </div>
            </div>
            <div className='overflow-x-auto'>
                <table className='w-full min-w-[82rem] table-fixed text-left text-sm'>
                    <thead className='bg-ui-raised text-xs text-ui-muted'><tr><th className='w-[24%] px-4 py-2'>Log</th><th className='w-[10%] px-4 py-2'>IP</th><th className='w-[20%] px-4 py-2'>User agent</th><th className='w-[9%] px-4 py-2 text-right'>Count (est.)</th><th className='w-[12%] px-4 py-2'>Last seen in sample</th><th className='w-[11%] px-4 py-2 text-right'>Triggers 24h (est.)</th><th className='w-[14%] px-4 py-2 text-right'>Row data (est.)</th></tr></thead>
                    <tbody>{sortedLogs.map(log => {
                        const parsedLastTriggered = log.last_triggered ? new Date(log.last_triggered) : null
                        const lastTriggered = parsedLastTriggered && Number.isFinite(parsedLastTriggered.getTime()) ? parsedLastTriggered : null
                        const lastTriggeredLabel = lastTriggered?.toLocaleString() || '—'
                        const tunableFields = log.message.length > 0 && log.message.length <= 200
                            && (!log.ip_path || log.ip.length <= 200)
                            && (!log.user_agent_path || log.user_agent.length <= 200)
                        return <tr key={JSON.stringify([log.message, log.ip, log.user_agent])} className='border-t border-ui-border align-top'>
                            <td className='px-4 py-3'><code className='block whitespace-pre-wrap wrap-break-word text-xs'>{log.message}</code><button type='button' disabled={!canManage || !tunableFields} onClick={() => { setSelected(log); setCreatedRule(null) }} className='mt-2 rounded-md border border-ui-border px-2.5 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50' title={!tunableFields ? 'This log message or a rule field is too long for an exact condition.' : canManage ? undefined : 'An Hanasand editor is required to create a suppression rule'}>Tune</button></td>
                            <td className='px-4 py-3 text-xs'><span className='wrap-break-word'>{log.ip || '—'}</span></td>
                            <td className='px-4 py-3 text-xs'><span className='wrap-break-word'>{log.user_agent || '—'}</span></td>
                            <td className='px-4 py-3 text-right tabular-nums'><SmoothedCount value={log.event_count} /></td>
                            <td className='px-4 py-3 text-xs tabular-nums' title={lastTriggered?.toISOString()}>{lastTriggeredLabel}</td>
                            <td className='px-4 py-3 text-right tabular-nums'><SmoothedCount value={log.last_24h_count} /></td>
                            <td className='px-4 py-3 text-right tabular-nums' title={`${numberFormat.format(Number(log.storage_bytes))} bytes`}>{formatBytes(Number(log.storage_bytes))}</td>
                        </tr>
                    })}
                    {!data?.logs.length && <tr><td colSpan={7} className='px-4 py-10 text-center text-sm text-ui-muted'>{data ? 'No stored log patterns.' : pending ? 'Preparing the summary in the background…' : error ? 'Log patterns could not be loaded.' : 'Loading patterns…'}</td></tr>}</tbody>
                </table>
            </div>
        </DashboardPanel>
        <p className='text-xs text-ui-muted'>Row data sums the stored event row sizes; PostgreSQL indexes and free space are excluded.</p>

        {selected && data && preset && <CreateRuleDialog key={JSON.stringify([selected.message, selected.ip, selected.user_agent])} category='analysis' organizationId={data.organizationId} canManage={canManage} canManageRetention={canManage} initialPreset={preset} storedLogsOnly onClose={() => setSelected(null)} onCreated={rule => {
            setSelected(null); setCreatedRule(rule); setError(''); void refresh()
        }} />}
    </DashboardPage>
}

function SmoothedCount({ value }: { value?: string }) {
    const parsed = value ? Number(value) : Number.NaN
    const target = Number.isFinite(parsed) ? parsed : null
    const [sample, setSample] = useState({ target, displayed: target })

    if (target !== sample.target) {
        const current = sample.displayed
        if (target == null) {
            setSample({ target, displayed: null })
        } else if (current == null || sample.target == null || target >= sample.target) {
            setSample({ target, displayed: target })
        } else {
            // 1% page samples are noisy, so lower estimates should take several snapshots to catch up.
            setSample({ target, displayed: current + (target - current) * 0.2 })
        }
    }

    return <>{sample.displayed == null ? '—' : numberFormat.format(Math.round(sample.displayed))}</>
}
