import type { WorkbenchDeliveryEvidence } from './evidence'
import type { WorkbenchProductReadinessItem } from './readiness'
import type { WorkbenchAction } from './evidence'

export type WorkbenchOrgContext = {
    scope: { tenantId: string, organizationId?: string }
    organization?: {
        id: string
        tenantId: string
        name: string
        slug: string
        status: string
        alertVisibilityPolicy?: 'members' | 'admins' | 'owners'
        updatedAt: string
    }
    members: Array<{ id: string, organizationId: string, email: string, role: string, status: string, userId?: string, updatedAt: string }>
    pendingInvites: Array<{ id: string, organizationId: string, email: string, role: string, status: string, expiresAt: string, updatedAt: string }>
    watchlists: Array<{ id: string, tenantId: string, organizationId?: string, name: string, terms: Array<{ value: string, kind?: string }>, webhookDestinationId?: string, status: string, updatedAt: string }>
    webhookDestinations: Array<{ id: string, organizationId: string, name: string, kind: string, status: string, lastTestStatus?: string, updatedAt: string }>
    readiness: {
        activeMemberCount: number
        pendingInviteCount: number
        activeWatchlistCount: number
        termCount: number
        activeWebhookCount: number
        alertVisibilityPolicy: 'members' | 'admins' | 'owners'
        blockedReasons: string[]
        liveAlertCount?: number
        sourceCoverage?: {
            sourceCount: number
            activeSourceCount: number
            captureCount: number
            watchlistMatchCount: number
            latestRunStatus?: string
            latestRunAt?: string
        }
        latestDelivery?: WorkbenchDeliveryEvidence
        fullChainReady: boolean
        fullChainBlockedBy: string[]
        productReadiness: WorkbenchProductReadinessItem[]
    }
    links: Array<{ href: string, label: string }>
    createWatchlistAction?: WorkbenchAction
}
