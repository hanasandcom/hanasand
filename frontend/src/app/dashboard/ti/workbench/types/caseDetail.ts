import type { CaseVisibilityDecision } from './case'
import type { CaseWorkflowEvent } from './case'
import type { CaseDelivery } from './case'
import type { CaseCustomerNotificationReceipt } from './case'
import type { CaseEvidence } from './case'
import type { CaseTimelineItem } from './case'
import type { CaseWatchlist } from './case'
import type { CaseAllowedAction } from './case'

export type CaseDetailPayload = {
    schemaVersion?: string
    generatedAt: string
    error?: { message?: string }
    organization?: { id?: string, name?: string, alertVisibilityPolicy?: 'members' | 'admins' | 'owners' }
    access?: {
        mode?: string
        memberId?: string
        role?: string
        readOnly?: boolean
        canMutate?: boolean
        visibilityDecision?: CaseVisibilityDecision
    }
    case?: {
        id: string
        alertId?: string
        title?: string
        summary?: string
        status?: string
        priority?: string
        assignedOwner?: string
        createdAt?: string
        updatedAt: string
        closedAt?: string
        lastDecision?: string
        workflowEvents?: CaseWorkflowEvent[]
    }
    alert?: { id?: string, sourceFamily?: string, sourceCount?: number, reviewState?: string, deliveryState?: string, matchedTerm?: { value?: string, kind?: string } }
    alertContext?: {
        id?: string
        reviewState?: string
        deliveryState?: string
        assignedOwner?: string
        workflowNote?: string
        workflowEvents?: CaseWorkflowEvent[]
    }
    deliveryContext?: {
        deliveryCount: number
        latestDelivery?: CaseDelivery
        delivered?: boolean
        retryable?: boolean
        failed?: CaseDelivery[]
    }
    customerNotificationContext?: {
        notificationCount: number
        notified: boolean
        latest?: CaseCustomerNotificationReceipt
        modes?: string[]
    }
    deliveries?: CaseDelivery[]
    evidence?: CaseEvidence[]
    timeline?: CaseTimelineItem[]
    watchlists?: CaseWatchlist[]
    nextActions?: string[]
    nextAllowedActions?: CaseAllowedAction[]
}
