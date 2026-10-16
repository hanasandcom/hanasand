import type { PublicTiHandoffDecodeResult } from '@/utils/ti/actorWorkbench'
import type { DeliveryItem, OperationsSnapshot, PortalAlert } from './types'

export type FindingsView = 'overview' | 'cases' | 'watchlists' | 'sources' | 'delivery' | 'actors' | 'actions'
export type DwmDataHealth = { snapshot: DataHealthItem, operations: DataHealthItem, alerts: DataHealthItem, deliveries: DataHealthItem }
export type DataHealthItem = { state: 'live' | 'fallback' | 'missing' | 'error', label: string, detail: string }
export type QueueFilter = 'active' | 'ready' | 'critical' | 'source' | 'high_confidence' | 'fresh' | 'pending_delivery' | 'reviewing' | 'delivered' | 'muted' | 'all'
export type InvestigationTab = 'evidence' | 'entities' | 'sources' | 'delivery'

export type PortalProps = {
    tenantId: string
    organizationId?: string
    snapshot: import('@/utils/dwm/product').DwmProductSnapshot
    operations: OperationsSnapshot | null
    alerts: PortalAlert[]
    deliveries: DeliveryItem[]
    dataHealth: DwmDataHealth
    initialAlertId?: string
    publicTiHandoff?: PublicTiHandoffDecodeResult | null
    isAdmin?: boolean
    view?: FindingsView
}
