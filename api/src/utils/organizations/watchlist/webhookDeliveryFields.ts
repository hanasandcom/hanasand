export const organizationWebhookRequiredAlertFields = [
    'alert.organizationId',
    'alert.tenantId',
    'alert.watchlistItemIds',
    'alert.workflowContext.alertGeneratorKeys',
    'alert.dedupeKey',
] as const

export const organizationWebhookRequiredDestinationFields = [
    'destination.id',
    'destination.org_id',
    'destination.enabled',
    'destination.eventSubscriptions',
] as const
