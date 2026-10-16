'use client'

import { formatRuleStorageBytes } from '../ruleStorageFormatting'
import { useState } from 'react'

export type LogPattern = {
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

type Props = { logs: LogPattern[], canManage: boolean, emptyLabel: string, onTune: (log: LogPattern) => void }
const numberFormat = new Intl.NumberFormat('en')

export default function LogPatternTable({ logs, canManage, emptyLabel, onTune }: Props) {
    return <table className='w-full min-w-[82rem] table-fixed text-left text-sm'>
        <thead className='bg-ui-raised text-xs text-ui-muted'><tr><th className='w-[24%] px-4 py-2'>Log</th><th className='w-[10%] px-4 py-2'>IP</th><th className='w-[20%] px-4 py-2'>User agent</th><th className='w-[9%] px-4 py-2 text-right'>Count (est.)</th><th className='w-[12%] px-4 py-2'>Last seen in sample</th><th className='w-[11%] px-4 py-2 text-right'>Triggers 24h (est.)</th><th className='w-[14%] px-4 py-2 text-right'>Row data (est.)</th></tr></thead>
        <tbody>{logs.map(log => {
            const parsedDate = log.last_triggered ? new Date(log.last_triggered) : null
            const lastTriggered = parsedDate && Number.isFinite(parsedDate.getTime()) ? parsedDate : null
            const tunable = log.message.length > 0 && log.message.length <= 200
                && (!log.ip_path || log.ip.length <= 200)
                && (!log.user_agent_path || log.user_agent.length <= 200)
            return <tr key={JSON.stringify([log.message, log.ip, log.user_agent])} className='border-t border-ui-border align-top'>
                <td className='px-4 py-3'><code className='block whitespace-pre-wrap wrap-break-word text-xs'>{log.message}</code><button type='button' disabled={!canManage || !tunable} onClick={() => onTune(log)} className='mt-2 rounded-md border border-ui-border px-2.5 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50' title={!tunable ? 'This log message or a rule field is too long for an exact condition.' : canManage ? undefined : 'An Hanasand editor is required to create a suppression rule'}>Tune</button></td>
                <td className='px-4 py-3 text-xs'><span className='wrap-break-word'>{log.ip || '—'}</span></td>
                <td className='px-4 py-3 text-xs'><span className='wrap-break-word'>{log.user_agent || '—'}</span></td>
                <td className='px-4 py-3 text-right tabular-nums'><SmoothedCount value={log.event_count} /></td>
                <td className='px-4 py-3 text-xs tabular-nums' title={lastTriggered?.toISOString()}>{lastTriggered?.toLocaleString() || '—'}</td>
                <td className='px-4 py-3 text-right tabular-nums'><SmoothedCount value={log.last_24h_count} /></td>
                <td className='px-4 py-3 text-right tabular-nums' title={`${numberFormat.format(Number(log.storage_bytes))} bytes`}>{formatRuleStorageBytes(Number(log.storage_bytes))}</td>
            </tr>
        })}
        {!logs.length && <tr><td colSpan={7} className='px-4 py-10 text-center text-sm text-ui-muted'>{emptyLabel}</td></tr>}</tbody>
    </table>
}

function SmoothedCount({ value }: { value?: string }) {
    const parsed = value ? Number(value) : Number.NaN
    const target = Number.isFinite(parsed) ? parsed : null
    const [sample, setSample] = useState({ target, displayed: target })

    if (target !== sample.target) {
        const current = sample.displayed
        if (target == null) setSample({ target, displayed: null })
        else if (current == null || sample.target == null || target >= sample.target) setSample({ target, displayed: target })
        // 1% page samples are noisy, so lower estimates catch up over several snapshots.
        else setSample({ target, displayed: current + (target - current) * 0.2 })
    }
    return <>{sample.displayed == null ? '—' : numberFormat.format(Math.round(sample.displayed))}</>
}
