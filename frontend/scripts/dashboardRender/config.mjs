export const expectedRows = {
    dashboard_evidence: '/dashboard',
    source_inventory_probe: '/ti/sources',
    end_to_end_workflow: '/ti/sources',
    dwm_product_snapshot: '/findings',
    entitlement_readiness: '/findings',
    webhook_delivery: '/automation?setup=dwm',
    org_alert_export: '/findings',
    webhook_health: '/automation?setup=dwm',
    organization_webhook_settings: '/organizations',
    helpdesk_audit: '/system/impersonation',
    deploy_probe: '/status',
    public_ti_provenance: '/ti',
}

export const viewports = [
    { name: 'desktop', width: 1440, height: 1000 },
    { name: 'mobile', width: 390, height: 844 },
]

export const colorSchemes = ['dark', 'light']

export const pageSpecs = [
    {
        id: 'dashboard',
        path: '/dashboard',
        requiredSelectors: ['[data-readiness-row-id]', '[data-readiness-owner-lane]', '[data-readiness-operator-action]', '[data-readiness-workflow-blocker]', '[data-readiness-customer-impact]', '[data-readiness-source-reference]', '[data-readiness-action-count]', '[data-readiness-backend-contract-version]', '[data-readiness-priority]', '[data-readiness-detail]', '[data-readiness-detail-actions]'],
    },
    {
        id: 'public_ti',
        path: '/ti',
        requiredSelectors: ['main'],
        allowedBannedCopy: ['apt29', 'lockbit'],
    },
    {
        id: 'public_ti_apt29',
        path: '/ti/apt29',
        requiredSelectors: ['main', '[data-ti-command-bar]'],
        allowedBannedCopy: ['apt29'],
    },
    {
        id: 'pwned',
        path: '/pwned',
        requiredSelectors: ['main'],
    },
    {
        id: 'ti_workbench',
        path: '/ti/workbench',
        requiredSelectors: ['main', '[role="listbox"][aria-label="Analyst case list"]'],
    },
    {
        id: 'cron_jobs',
        path: '/automation/cron',
        requiredSelectors: ['main', 'button'],
    },
    {
        id: 'vulnerabilities',
        path: '/vulnerabilities',
        requiredSelectors: ['main'],
    },
    {
        id: 'traffic',
        path: '/traffic',
        requiredSelectors: ['main'],
    },
    {
        id: 'system',
        path: '/system',
        requiredSelectors: ['main'],
    },
    {
        id: 'database',
        path: '/db',
        requiredSelectors: ['main'],
    },
    {
        id: 'logs',
        path: '/logs',
        requiredSelectors: ['main'],
    },
    {
        id: 'automations',
        path: '/automation',
        requiredSelectors: ['main'],
    },
    {
        id: 'organizations',
        path: '/organizations',
        requiredSelectors: ['main', '#destinations', '#watchlists', '#audit'],
    },
    {
        id: 'subscription',
        path: '/subscription',
        requiredSelectors: ['main'],
    },
    {
        id: 'notes',
        path: '/notes',
        requiredSelectors: ['main'],
    },
    {
        id: 'ti_activity',
        path: '/ti/activity',
        requiredSelectors: ['main'],
    },
    {
        id: 'ti_audit',
        path: '/ti/audit',
        requiredSelectors: ['main'],
    },
    {
        id: 'ti_enrichment',
        path: '/ti/profiles',
        requiredSelectors: ['main'],
    },
    {
        id: 'ti_sources',
        path: '/ti/sources',
        requiredSelectors: ['main'],
    },
    {
        id: 'ti_runs',
        path: '/ti/runs',
        requiredSelectors: ['main'],
    },
]

export const bannedCopy = [
    'control room',
    'prompt-shaped',
    'acceptance criteria',
    'coordinator',
    'delegation',
    'you are tasked',
    'worker 3',
    'ti control room',
    'how this feeds',
    '/ti/<query>',
    'dashboard slop',
    'dashboard handoff',
    'backed handoff',
    'apt29',
    'lockbit',
]

export const deadEndCopyPatterns = [
    { label: 'blocked', pattern: '\\bblocked\\b', allowedNearby: ['recapture', 'retry'] },
    { label: 'needs action', pattern: '\\bneeds action\\b' },
    { label: 'action required', pattern: '\\baction required\\b' },
    { label: 'needs work', pattern: '\\bneeds work\\b' },
    { label: 'needs proof', pattern: '\\bneeds proof\\b' },
    { label: 'will appear here after', pattern: 'will appear here after' },
    { label: 'ai parser output', pattern: 'ai parser output' },
    { label: 'source provenance', pattern: 'source provenance' },
    { label: 'evidence-backed', pattern: 'evidence-backed' },
    { label: 'source-backed', pattern: 'source-backed' },
]

export const highContrastDarkTokens = ['border-white/', 'bg-white/10', 'bg-white/15']
export const localAuthFixture = {
    header: 'local-dashboard-render-proof',
    id: 'dashboard-render-proof-user',
    name: 'Dashboard Render Proof',
    token: 'local-dashboard-render-proof-token',
}
