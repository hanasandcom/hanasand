export const organizationAccessDownstreamRoutes = {
    sharedWatchlists: 'GET /api/organizations/:id/watchlists',
    alertTermsExport: 'GET /api/organizations/:id/watchlists/alert-terms',
    alertCaseVisibility: 'GET /api/organizations/:id/alert-case-visibility',
    alertReadiness: 'GET /api/organizations/:id/alert-readiness',
    webhookDelivery: 'POST /v1/dwm/webhooks/deliver',
} as const

export const removedMemberBlockedRoutes = [
    organizationAccessDownstreamRoutes.sharedWatchlists,
    organizationAccessDownstreamRoutes.alertTermsExport,
    organizationAccessDownstreamRoutes.alertCaseVisibility,
    organizationAccessDownstreamRoutes.alertReadiness,
    organizationAccessDownstreamRoutes.webhookDelivery,
] as const
