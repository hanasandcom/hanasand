import type { WatchlistItem } from '../types/watchlists'
import type { DeliveryRow } from '../types/delivery'
import { formatDate } from '../model/labels'
import { destinationConfigured } from '../model/watchlists'
import { StatusPill } from './shared'
import { destinationDisplayState } from '../model/organization'
import { compactReference } from '../model/references'
import { sanitizeOrganizationDisplayCopy } from '../model/textSafety'
import { Webhook } from 'lucide-react'
import Link from 'next/link'

export function WatchlistDestinationSummary({ item, delivery }: { item: WatchlistItem, delivery?: DeliveryRow | null }) {
    const endpoint = sanitizeOrganizationDisplayCopy(item.webhookEndpointHint) || compactReference(item.webhookEndpointHash, 'route')
    return (
        <div className='grid gap-1 rounded-lg border border-ui-border bg-ui-panel p-3 text-xs dark:border-ui-border dark:bg-ui-panel'>
            <div className='flex items-center justify-between gap-2'>
                <span className='font-semibold text-ui-text dark:text-ui-text'>Destination</span>
                <StatusPill status={destinationConfigured(item) ? 'configured' : 'route needed'} />
            </div>
            <span className='truncate text-ui-muted dark:text-ui-muted'>{destinationDisplayState(item)}</span>
            {endpoint && <span className='truncate text-ui-muted dark:text-ui-muted'>Route: {endpoint}</span>}
            <span className='truncate text-ui-muted dark:text-ui-muted'>{delivery ? `Last ${delivery.dryRun ? 'test' : 'delivery'} ${delivery.status || 'attempted'}` : 'No delivery history yet'}</span>
            <span className='truncate text-ui-muted dark:text-ui-muted'>History: {delivery ? formatDate(delivery.attemptedAt || delivery.updatedAt || delivery.createdAt) : 'waiting for test'}</span>
            <Link href='/findings/delivery' className='mt-1 inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-ui-border bg-ui-raised px-3 text-sm font-semibold text-ui-text transition hover:border-ui-primary dark:border-ui-border dark:bg-ui-canvas dark:text-ui-text' onClick={event => event.stopPropagation()}>
                <Webhook className='h-4 w-4' />
                Open integrations
            </Link>
        </div>
    )
}
