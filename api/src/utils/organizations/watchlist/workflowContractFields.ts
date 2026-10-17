export const organizationCaseWorkflowRequiredFields = [
    'organizationId',
    'tenantId',
    'alertId',
    'casePath',
    'watchlistItemIds',
    'allowedActions',
    'visibilityDecision',
    'evidence.provenance',
] as const

export const organizationCaseWorkflowTimelineEvents = [
    'case.opened',
    'case.linked_alert',
    'case.assigned',
    'case.status_changed',
    'case.note_added',
] as const

export const organizationCaseWorkflowEvidenceFields = [
    'alertId',
    'watchlistItemIds',
    'alertGeneratorKeys',
    'matchedTerms',
    'source',
    'capturedAt',
    'casePath',
] as const

export const organizationWebhookDeliveryEvidenceFields = [
    'deliveryId',
    'destinationId',
    'attemptedAt',
    'status',
    'casePath',
    'watchlistItemIds',
    'auditEventContracts',
] as const
