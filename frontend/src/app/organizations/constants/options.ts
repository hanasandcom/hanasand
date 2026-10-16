import type { OrganizationRole } from '../types/organization'
import type { WatchlistKind } from '../types/watchlists'

export const roleOptions: OrganizationRole[] = ['admin', 'editor', 'reader']
export const watchlistKinds: WatchlistKind[] = ['company', 'domain', 'vendor', 'actor', 'keyword']
export const watchlistTemplates: Array<{ label: string, kind: WatchlistKind, notes: string }> = [
    { label: 'Corporate domain', kind: 'domain', notes: 'Primary company domain monitored for exposure mentions.' },
    { label: 'Supplier', kind: 'vendor', notes: 'Critical supplier, processor, or integration partner.' },
    { label: 'Company name', kind: 'company', notes: 'Legal entity or operating brand used in source matching.' },
    { label: 'Actor keyword', kind: 'actor', notes: 'Threat actor, leak site, or campaign label relevant to this organization.' },
]
export const webhookPolicies = ['active_destinations', 'manual_selection', 'disabled']
export const alertPolicies = ['members', 'admins', 'owners']
export const lifecycleStatuses = ['active', 'archived']
