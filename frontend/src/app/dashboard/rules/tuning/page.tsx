'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw, SlidersHorizontal } from 'lucide-react'
import { DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
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
    protected_event_count: string
    event_count: string
    storage_bytes: string
}
type TuningData = { organizationId: string, generatedAt: string | null, logs: LogPattern[], pending: boolean, refreshing: boolean }

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
    if (log.ip_path && log.ip) conditions.push({ path: log.ip_path, operator: 'equals', value: log.ip, caseSensitive: true })
    if (log.user_agent_path && log.user_agent) conditions.push({ path: log.user_agent_path, operator: 'equals', value: log.user_agent, caseSensitive: true })
    return {
        name: `Suppress: ${log.message}`.slice(0, 120),
        explanation: 'Suppress this repeated stored log pattern using the message and available IP and user agent fields.',
        stage: 'analyze',
        action: 'drop',
        conditions,
    }
}

export default function TuningPage() {
    const { organizations } = useWorkspace()
    const [data, setData] = useState<TuningData | null>(null)
    const [selected, setSelected] = useState<LogPattern | null>(null)
    const [createdRule, setCreatedRule] = useState<Rule | null>(null)
    const [error, setError] = useState('')
    const [pending, setPending] = useState(false)
    const canManage = organizations.some(organization => organization.id === data?.organizationId
        && ['owner', 'admin', 'editor'].includes(organization.role?.toLowerCase() || ''))

    const refresh = useCallback(async (signal?: AbortSignal) => {
        if (document.visibilityState !== 'visible') return
        try {
            const payload = await requestJson<TuningData>('/api/backend/logs/tuning', { cache: 'no-store', signal })
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
    }, [])

    const requestRefresh = useCallback(async () => {
        try {
            await requestJson<{ refreshing: boolean }>('/api/backend/logs/tuning/refresh', { method: 'POST' })
            setError('')
            await refresh()
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'The background refresh could not be queued.')
        }
    }, [refresh])
    const completeReprocessing = useCallback(() => { void requestRefresh() }, [requestRefresh])

    useEffect(() => {
        const controller = new AbortController()
        void refresh(controller.signal)
        const interval = window.setInterval(() => void refresh(), pending ? 15_000 : 30_000)
        const onVisible = () => { if (document.visibilityState === 'visible') void refresh() }
        document.addEventListener('visibilitychange', onVisible)
        return () => { controller.abort(); window.clearInterval(interval); document.removeEventListener('visibilitychange', onVisible) }
    }, [refresh, pending])

    const preset = useMemo(() => selected ? rulePreset(selected) : undefined, [selected])
    const displayedAt = data?.generatedAt ? new Date(data.generatedAt).toLocaleString() : ''

    return <DashboardPage className='!gap-5 !px-2 !py-4'>
        <header className='flex flex-wrap items-center justify-between gap-3'>
            <div><h1 className='flex items-center gap-2 text-2xl font-semibold'><SlidersHorizontal size={22} aria-hidden />Log tuning</h1>
                <p className='mt-1 text-sm text-ui-muted'>The 100 most common stored logs, grouped by message, IP, and user agent.</p></div>
            <button type='button' onClick={() => void requestRefresh()} className='inline-flex items-center gap-2 rounded-lg border border-ui-border px-3 py-2 text-sm'><RefreshCw size={15} aria-hidden />Refresh summary</button>
        </header>

        {error && <p role='alert' className='rounded-lg border border-ui-danger/40 bg-ui-danger/10 p-3 text-sm text-ui-danger'>{error}</p>}
        {createdRule && data && <ReprocessRule key={createdRule.id} rule={createdRule} organizationId={data.organizationId} disabled={!canManage} defaultRange='all' onComplete={completeReprocessing} />}

        <DashboardPanel className='min-w-0 overflow-hidden'>
            <div className='flex flex-wrap items-center justify-between gap-2 border-b border-ui-border px-4 py-3'>
                <h2 className='font-semibold'>Stored log patterns</h2>
                <p className='text-xs text-ui-muted'>{data?.refreshing ? `Refreshing in background${displayedAt ? ` · showing snapshot from ${displayedAt}` : ''}…` : displayedAt ? `Updated ${displayedAt}` : pending ? 'Preparing the summary in the background…' : 'Loading patterns…'}</p>
            </div>
            <div className='overflow-x-auto'>
                <table className='w-full min-w-[60rem] table-fixed text-left text-sm'>
                    <thead className='bg-ui-raised text-xs text-ui-muted'><tr><th className='w-[32%] px-4 py-2'>Log</th><th className='w-[14%] px-4 py-2'>IP</th><th className='w-[25%] px-4 py-2'>User agent</th><th className='w-[11%] px-4 py-2 text-right'>Count</th><th className='w-[18%] px-4 py-2 text-right'>Row data</th></tr></thead>
                    <tbody>{(data?.logs || []).map(log => {
                        const protectedCount = Number(log.protected_event_count)
                        const tunableFields = log.message.length > 0 && log.message.length <= 200
                            && (!log.ip_path || log.ip.length <= 200)
                            && (!log.user_agent_path || log.user_agent.length <= 200)
                        return <tr key={JSON.stringify([log.message, log.ip, log.user_agent])} className='border-t border-ui-border align-top'>
                            <td className='px-4 py-3'><code className='block whitespace-pre-wrap wrap-break-word text-xs'>{log.message}</code>{protectedCount > 0 && <p className='mt-1 text-xs text-ui-warning'>{numberFormat.format(protectedCount)} failure or detection events — review before suppressing</p>}<button type='button' disabled={!canManage || !tunableFields} onClick={() => { setSelected(log); setCreatedRule(null) }} className='mt-2 rounded-md border border-ui-border px-2.5 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50' title={!tunableFields ? 'This log message or a rule field is too long for an exact condition.' : canManage ? undefined : 'An Hanasand editor is required to create a suppression rule'}>Tune</button></td>
                            <td className='px-4 py-3 text-xs'><span className='wrap-break-word'>{log.ip || '—'}</span></td>
                            <td className='px-4 py-3 text-xs'><span className='wrap-break-word'>{log.user_agent || '—'}</span></td>
                            <td className='px-4 py-3 text-right tabular-nums'>{numberFormat.format(Number(log.event_count))}</td>
                            <td className='px-4 py-3 text-right tabular-nums' title={`${numberFormat.format(Number(log.storage_bytes))} bytes`}>{formatBytes(Number(log.storage_bytes))}</td>
                        </tr>
                    })}
                    {!data?.logs.length && <tr><td colSpan={5} className='px-4 py-10 text-center text-sm text-ui-muted'>{data ? 'No stored log patterns.' : pending ? 'Preparing the summary in the background…' : error ? 'Log patterns could not be loaded.' : 'Loading patterns…'}</td></tr>}</tbody>
                </table>
            </div>
        </DashboardPanel>
        <p className='text-xs text-ui-muted'>Row data sums the stored event row sizes; PostgreSQL indexes and free space are excluded. The saved summary refreshes in the background, and opening this page only reads the latest snapshot.</p>

        {selected && data && preset && <CreateRuleDialog key={JSON.stringify([selected.message, selected.ip, selected.user_agent])} category='analysis' organizationId={data.organizationId} canManage={canManage} canManageRetention={canManage} rules={[]} initialPreset={preset} onClose={() => setSelected(null)} onCreated={rule => {
            setSelected(null); setCreatedRule(rule); setError('')
        }} />}
    </DashboardPage>
}
