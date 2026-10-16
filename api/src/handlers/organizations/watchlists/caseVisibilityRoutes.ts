export const organizationAlertCaseVisibilityRoutes = {
    alertList: 'GET /v1/dwm/alerts?organizationId=:organizationId',
    alertDetail: 'GET /v1/dwm/alerts/:id',
    caseList: 'GET /v1/cases?organizationId=:organizationId',
    caseDetail: 'GET /v1/cases/:id',
    webhookDelivery: 'POST /v1/dwm/webhooks/deliver',
    alertTermsExport: 'GET /api/organizations/:id/watchlists/alert-terms',
} as const
