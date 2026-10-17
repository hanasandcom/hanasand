export const organizationMembershipBlockedDownstreamRoutes = [
    'GET /api/organizations/:id/watchlists',
    'GET /api/organizations/:id/watchlists/alert-terms',
    'GET /api/organizations/:id/alert-case-visibility',
    'POST /v1/dwm/webhooks/deliver',
] as const
