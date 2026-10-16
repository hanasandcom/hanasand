export const apiBase = process.env.PLAYWRIGHT_API_BASE || 'http://127.0.0.1:8080/api'
export const root = process.cwd()
export const password = `Aa11!!${Date.now()}Bb22!!`
export const adminId = process.env.PLAYWRIGHT_ADMIN_ID || ''
export const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD || ''
export const adminName = process.env.PLAYWRIGHT_ADMIN_NAME || 'Dashboard Resource Smoke'
export const adminToken = process.env.PLAYWRIGHT_ADMIN_TOKEN || ''
export const adminExpiresAt = process.env.PLAYWRIGHT_ADMIN_EXPIRES_AT || new Date(Date.now() + 60 * 60 * 1000).toISOString()
export const hasAdminToken = Boolean(adminToken && adminId)
export const hasAdminLoginCredentials = Boolean(adminId && adminPassword)

export const dashboardRoutes = [
    { path: '/dashboard', heading: /Good|You're|It’s/ },
    { path: '/dashboard', heading: 'Operations Overview', screenshot: 'dashboard-overview.png' },
    { path: '/findings', heading: 'Company and vendor exposure alerts' },
    { path: '/subscription', heading: 'Choose what you need' },
]

export const normalSidebarLinks = [
    { name: 'Console', href: '/dashboard' },
    { name: 'Threat search', href: '/ti' },
    { name: 'Dark web', href: '/findings' },
    { name: 'API docs', href: '/developers' },
    { name: 'Subscription', href: '/subscription' },
]

export const privilegedSidebarLinks = [
    'Collection',
    'Attacks',
    'Latest activity',
    'Actor profiles',
    'Sources',
    'Watched entities',
    'Collection runs',
    'Audit log',
    'VMs',
    'Projects',
    'Shares',
    'Mail',
    'Automations',
    'Content management',
    'Notes',
    'Load testing',
    'Traffic',
    'System',
    'AI Metrics',
    'Vulnerabilities',
    'Articles',
    'Thoughts',
    'Logs',
    'Database',
    'Backup',
    'Rate Limits',
    'Cron Jobs',
    'Impersonation',
    'Management',
]

export const privilegedDashboardRoutes = [
    { path: '/vms', heading: 'Virtual Machines' },
    { path: '/projects', heading: 'Projects' },
    { path: '/shares', heading: 'Code shares and projects' },
    { path: '/mail', heading: 'Mail' },
    { path: '/automation', heading: 'Automations' },
    { path: '/notes', heading: 'Notes' },
    { path: '/traffic', heading: 'Traffic' },
    { path: '/system', heading: 'System metrics' },
    { path: '/system/ai', heading: 'AI Metrics' },
    { path: '/vulnerabilities', heading: 'Vulnerabilities' },
    { path: '/load-testing', heading: 'Load testing and endpoint evidence' },
    { path: '/content/articles', heading: 'Articles' },
    { path: '/content/thoughts', heading: 'Thoughts' },
    { path: '/logs', heading: 'Logs' },
    { path: '/db', heading: 'Database' },
    { path: '/db/backups', heading: 'Database backups' },
    { path: '/system/rates', heading: 'Rate Limits' },
    { path: '/automation/cron', heading: 'Cron Jobs' },
    { path: '/system/impersonation', heading: /Support access|Impersonation/ },
    { path: '/management', heading: 'Admin' },
]

export const adminOnlyOperationHrefs = [
    '/automation',
    '/projects',
    '/shares',
    '/logs',
    '/mail',
    '/db',
    '/system/rates',
    '/automation/cron',
    '/system/impersonation',
    '/management',
]
