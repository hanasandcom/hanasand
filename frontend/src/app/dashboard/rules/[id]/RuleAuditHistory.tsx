import Link from '@/components/organizations/workspaceLink'
import { History } from 'lucide-react'
import { DashboardPanel } from 'hanasand/dashboard'

export type RuleAuditEntry = {
    id: string
    event_type: string
    actor_id: string | null
    created_at: string
    context: { before?: Record<string, unknown> | null, after?: Record<string, unknown>, action?: string }
}

type Props = {
    entries: RuleAuditEntry[]
    currentVersion?: string
    ruleId: string
    nextOffset: number | null
    busy: boolean
    onLoadMore: () => void
}

export default function RuleAuditHistory({ entries, currentVersion, ruleId, nextOffset, busy, onLoadMore }: Props) {
    const currentRuleId = ruleId.replace(/\.v\d+$/, '')

    return <DashboardPanel className='grid gap-4 p-5 sm:p-6'>
        <div className='flex items-center gap-2'><History size={18} className='text-ui-muted' aria-hidden='true' /><h2 className='text-sm font-semibold'>Audit log</h2></div>
        {!entries.length && <p className='text-sm text-ui-muted'>No recorded changes for this rule in this organization.</p>}
        <ol className='divide-y divide-ui-border'>{entries.map(entry => <li key={entry.id}>
            <details className='py-4'>
                <summary className='flex cursor-pointer flex-wrap justify-between gap-2 text-sm'>
                    <span className='font-semibold'>{entry.event_type === 'event.rule.created' ? 'Rule created' : entry.event_type === 'event.rule.imported' ? 'Rule imported' : 'Rule updated'}{entry.context.action ? ` · ${entry.context.action}` : ''} · {entry.actor_id || 'System'}</span>
                    <time dateTime={entry.created_at}>{new Date(entry.created_at).toLocaleString()}</time>
                </summary>
                <div className='pt-3'>
                    {typeof entry.context.before?.version === 'string' && entry.context.before.version !== currentVersion && <Link href={`/rules/${currentRuleId}.v${entry.context.before.version}`} className='mr-3 text-xs underline'>View version {entry.context.before.version}</Link>}
                    {typeof entry.context.after?.version === 'string' && entry.context.after.version !== currentVersion && <Link href={`/rules/${currentRuleId}.v${entry.context.after.version}`} className='text-xs underline'>View version {entry.context.after.version}</Link>}
                    {entry.context.after && <dl className='mt-3 grid gap-2 rounded-lg border border-ui-border bg-ui-raised p-3 text-xs'>{Object.entries(entry.context.after).filter(([key, value]) => (key !== 'version' || value !== currentVersion) && JSON.stringify(entry.context.before?.[key]) !== JSON.stringify(value)).map(([key, value]) => <div key={key} className='grid min-w-0 gap-1 sm:grid-cols-[7rem_minmax(0,1fr)]'><dt className='font-medium capitalize'>{key === 'definition' ? 'Conditions' : key}</dt><dd className='wrap-break-word whitespace-pre-wrap text-ui-muted'>{entry.context.before && <><span>{displayValue(entry.context.before[key])}</span><span aria-label='changed to'> → </span></>}{displayValue(value)}</dd></div>)}</dl>}
                </div>
            </details>
        </li>)}</ol>
        {nextOffset !== null && <button type='button' disabled={busy} onClick={onLoadMore} className='justify-self-start rounded-lg border border-ui-border px-3 py-2 text-sm'>Load older changes</button>}
    </DashboardPanel>
}

function displayValue(value: unknown): string {
    if (value == null) return 'Not set'
    if (typeof value === 'boolean') return value ? 'Enabled' : 'Disabled'
    return typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)
}
