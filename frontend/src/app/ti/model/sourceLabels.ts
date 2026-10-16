import { decisionStepStatusClass, formatLabel } from './reviewLabels'
import { type TiActionabilityModel } from '@/utils/ti/actionability'
import { type TiSearchResponse } from '@/utils/ti/search'

export function coverageMissingLabel(value: string) {
    if (value.includes('captureId')) return 'capture references'
    if (value.includes('reportDate')) return 'report dates'
    if (value.includes('sourceId')) return 'source references'
    if (value.includes('structuredProvenance')) return 'structured source details'
    if (value.includes('datedActivityRow')) return 'dated activity'
    if (value.includes('provenanceRefs')) return 'source references'
    return formatLabel(value)
}

export function watchlistIntersectionActionLabel(value: TiActionabilityModel['orgRelevance']['watchlistIntersections'][number]['recommendedAction']) {
    if (value === 'open_watchlist_item') return 'Open saved watchlist item'
    if (value === 'persist_watchlist_item') return 'Save watchlist item'
    if (value === 'rebuild_alerts') return 'Rebuild related alerts'
    if (value === 'open_case') return 'Open related case'
    return 'Attach source evidence'
}

export function humanResultStatus(value?: string) {
    if (!value) return 'Monitoring'
    if (value === 'metadata_review') return 'Needs review'
    if (value === 'needs_source_activation') return 'Connecting sources'
    if (value === 'blocked_unsafe_target') return 'Review required'
    if (value === 'ready') return 'Ready'
    if (value === 'partial') return 'Updating'
    if (value === 'unavailable') return 'Unavailable'
    if (value === 'searching' || value === 'queued') return 'Searching'
    return formatLabel(value)
}

export function sourceStatusLabel(value: string) {
    if (/metadata/i.test(value)) return 'Monitoring data'
    if (/available|ready|active/i.test(value)) return 'Included'
    if (/context/i.test(value)) return 'Context'
    return 'Included'
}

export function sourceCountLabel(count: number) {
    if (count <= 0) return 'No sources'
    return `${Math.min(count, 5)} shown${count > 5 ? ` of ${count}` : ''}`
}

export function activitySourceLabel(count: number) {
    if (count <= 0) return 'Source pending'
    return count === 1 ? '1 source' : `${count} sources`
}

export function sourceRoleLabel(value: string) {
    if (value === 'primary_seed') return 'Seed coverage'
    if (value === 'owned_collection_target') return 'Owned monitoring'
    if (value === 'corroboration') return 'Corroboration'
    if (value === 'context_only') return 'Context'
    return formatLabel(value)
}

export function sourceActivationActionLabel(value: NonNullable<TiSearchResponse['analystLoop']>['sourceActivationWorkflow']['actions'][number]['action']) {
    if (value === 'request_approval') return 'Request approval'
    if (value === 'restore_source') return 'Restore source'
    if (value === 'enable_metadata_only_queue') return 'Watch this source without storing stolen files'
    return 'Keep monitoring'
}

export function sourceActivationExecutionLabel(value: NonNullable<TiSearchResponse['analystLoop']>['sourceActivationWorkflow']['actions'][number]['execution']) {
    if (value === 'human_approval_required') return 'approval required'
    if (value === 'dry_run') return 'review only'
    return 'syncing'
}

export function sourceActivationExecutionClass(value: NonNullable<TiSearchResponse['analystLoop']>['sourceActivationWorkflow']['actions'][number]['execution']) {
    if (value === 'dry_run') return decisionStepStatusClass('review')
    if (value === 'human_approval_required') return decisionStepStatusClass('review')
    return decisionStepStatusClass('blocked')
}

export function sourceHealthFieldLabel(value: string) {
    if (/captureId/i.test(value)) return 'capture reference'
    if (/sourceRequestId/i.test(value)) return 'source request'
    if (/reportDate|lastSeen|firstReportedAt/i.test(value)) return 'report date'
    if (/sourceId/i.test(value)) return 'source reference'
    if (/provenance|sourceUrl|url/i.test(value)) return 'source reference'
    if (/relatedAlerts.*id|alertId/i.test(value)) return 'alert review'
    if (/casePath|caseId/i.test(value)) return 'case link'
    if (/webhookDestination/i.test(value)) return 'webhook destination'
    if (/organizationId|tenantId/i.test(value)) return 'organization scope'
    if (/watchlistItem|watchlistId/i.test(value)) return 'watchlist item'
    if (/endpoint|route/i.test(value)) return 'console path'
    return formatLabel(value.replace(/\[\]/g, '').replace(/\./g, ' '))
}
