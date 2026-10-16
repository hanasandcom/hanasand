import Link from '@/components/organizations/workspaceLink'
import { ArrowLeft } from 'lucide-react'
import type { DeliveryRow } from './evidenceTypes'
import { queryString } from './model'
import { CasePill } from './presentation'

export function CaseHeader({ caseRecord, alert, organizationId, latestDelivery, deliveryCount, caseMeta }: {
    caseRecord: { id: string, title?: string, status?: string, priority?: string }
    alert?: { severity?: string }
    organizationId?: string
    latestDelivery?: DeliveryRow
    deliveryCount: number
    caseMeta: string
}) {
    return (
        <div className='grid min-w-0 gap-3 border-b border-ui-border px-4 py-3 sm:flex sm:flex-wrap sm:items-center sm:justify-between'>
            <div className='min-w-0 flex-1'>
                <Link href={`/cases${queryString({ organizationId })}`} className='inline-flex items-center gap-2 text-[11px] font-semibold uppercase text-ui-primary'><ArrowLeft className='h-3.5 w-3.5' />Cases</Link>
                <h1 className='mt-2 min-w-0 wrap-break-word text-xl font-semibold text-ui-text'>{caseRecord.title || caseRecord.id}</h1>
                <p className='mt-1 wrap-break-word text-xs text-ui-muted'>{caseMeta}</p>
            </div>
            <div className='flex flex-wrap gap-2'>
                <CasePill label='Status' value={caseRecord.status || 'open'} tone={caseRecord.status === 'closed' ? 'neutral' : 'ready'} />
                <CasePill label='Priority' value={caseRecord.priority || alert?.severity || 'medium'} tone={alert?.severity === 'critical' ? 'warn' : 'neutral'} />
                <CasePill label='Delivery' value={latestDelivery?.status || (deliveryCount ? 'attempted' : 'not sent')} tone={latestDelivery?.status === 'delivered' ? 'ready' : latestDelivery?.status === 'failed' ? 'warn' : 'neutral'} />
            </div>
        </div>
    )
}
