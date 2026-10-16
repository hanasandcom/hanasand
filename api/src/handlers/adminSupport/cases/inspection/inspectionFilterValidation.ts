import { auditFilterValidationError } from '#utils/support/auditFilterValidation.ts'
import { supportError } from '#utils/support/adminSupportInput.ts'
import { supportInspectionFilters, type SupportTimelineFilter } from '#utils/support/inspectionPackets.ts'
import { supportTimelineFilter } from './timelineFilter.ts'
import type { SupportInspectionQuery } from './inspectionRequest.ts'

export function supportInspectionFilterError(
    rawQuery: SupportInspectionQuery,
    filter: Omit<SupportTimelineFilter, 'unsupported'>,
) {
    const validationError = auditFilterValidationError(rawQuery, filter, {
        supportedFilters: supportInspectionFilters,
        unsupportedCode: 'unsupported_support_filter',
        unsupportedLabel: 'support inspection',
        invalidCode: 'invalid_support_filter',
        dateLabel: 'audit timeline',
        limitMessage: 'Support inspection limit must be a positive number.',
    })
    if (validationError) return validationError
    const hasTarget = Boolean(filter.q || filter.org || filter.user || filter.email || filter.request || filter.entity || filter.entityType || filter.supportSession || filter.workflow || filter.blocker || filter.reason || filter.scope || filter.context)
    if (!hasTarget && Boolean(filter.action || filter.source || filter.service || filter.severity || filter.outcome || filter.from || filter.to)) {
        return supportError('overbroad_support_timeline_filter', 'Add org, user, email, request, entity, entityType, or supportSession with audit timeline filters.', {
            filters: supportTimelineFilter(filter),
        })
    }
    return null
}
