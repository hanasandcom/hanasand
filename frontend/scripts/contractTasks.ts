import { bun, type TestTask } from './testTask'

export const contractTasks: TestTask[] = [
    {
        id: 'auth-login-timeout',
        title: 'Login handles auth timeouts',
        command: [bun, 'tests/auth-login-timeout.test.ts'],
    },
    {
        id: 'auth-validation-recovery',
        title: 'Authentication failure and recovery',
        command: [bun, 'tests/auth-validation-recovery.test.ts'],
    },
    {
        id: 'auth-recovery-browser',
        title: 'Authentication recovery in browser',
        command: [bun, 'scripts/check-auth-recovery.mjs'],
        requires: 'playwright',
    },
    {
        id: 'automation-routes',
        title: 'Automation route regression',
        command: [bun, 'scripts/check-automation-routes.mjs'],
    },
    {
        id: 'dashboard-navigation-structure',
        title: 'Navigation grouping and organization destinations',
        command: [bun, 'test', 'tests/dashboard-navigation.test.ts'],
    },
    {
        id: 'dashboard-navigation',
        title: 'Dashboard navigation interactions',
        command: [bun, 'scripts/check-dashboard-navigation.mjs'],
        requires: 'playwright',
    },
    {
        id: 'dashboard-sidebar-shell',
        title: 'Dashboard sidebar shell contract',
        command: [bun, 'scripts/check-dashboard-sidebar-shell.mjs'],
    },
    {
        id: 'status-traffic',
        title: 'Status traffic contract',
        command: [bun, 'scripts/check-status-traffic.mjs'],
    },
    {
        id: 'article-fallback',
        title: 'Article fallback contract',
        command: [bun, 'scripts/check-article-fallback.mjs'],
    },
    {
        id: 'customer-operational-copy',
        title: 'Customer operational copy guard',
        command: [bun, 'scripts/check-customer-operational-copy.mjs'],
    },
    {
        id: 'upload-limit',
        title: 'Upload proxy limit contract',
        command: [bun, 'scripts/check-upload-proxy-limit.mjs'],
    },
    {
        id: 'database-dashboard-render',
        title: 'Database dashboard render contract',
        command: [bun, 'scripts/check-database-dashboard-render.ts'],
    },
    {
        id: 'pwned-proxy-route',
        title: 'Pwned proxy route contract',
        command: [bun, 'scripts/check-pwned-proxy-route.ts'],
    },
    {
        id: 'compact-range',
        title: 'Compact index browser decoding',
        command: [bun, 'scripts/check-compact-range.ts'],
    },
    {
        id: 'pwned-result-presentation',
        title: 'Pwned result presentation contract',
        command: [bun, 'scripts/check-pwned-result-presentation.ts'],
    },
    {
        id: 'ai-hooks',
        title: 'AI hook startup contract',
        command: [bun, 'scripts/check-ai-hooks.mjs'],
    },
    {
        id: 'backup-operations',
        title: 'Backup operations page contract',
        command: [bun, 'scripts/check-backup-operations.ts'],
    },
    {
        id: 'vulnerability-dashboard',
        title: 'Vulnerability dashboard contract',
        command: [bun, 'scripts/check-vulnerability-dashboard.ts'],
    },
    {
        id: 'service-check-ti-landing',
        title: 'Service check and TI landing UX contract',
        command: [bun, 'scripts/check-service-check-ti-landing.mjs'],
    },
    {
        id: 'shared-exposure-activity',
        title: 'Shared exposure activity',
        command: [bun, 'scripts/check-shared-exposure-activity.ts'],
    },
    {
        id: 'ti-actor-intelligence',
        title: 'TI actor intelligence shaping',
        command: [bun, 'scripts/check-ti-actor-intelligence.ts'],
    },
    {
        id: 'ti-varnish-freshness',
        title: 'TI public cache freshness',
        command: [bun, 'scripts/check-ti-varnish-freshness.mjs'],
    },
    {
        id: 'dwm-analyst-brief',
        title: 'DWM analyst brief',
        command: [bun, 'scripts/check-dwm-analyst-brief.mjs'],
    },
    {
        id: 'organization-customer-boundaries',
        title: 'Organization customer boundaries',
        command: [bun, 'test', 'tests/organization-customer-boundaries.test.mjs'],
    },
    {
        id: 'organization-alert-reference',
        title: 'Organization alert reference safety',
        command: [bun, 'test', './tests/organization-alert-reference.check.ts'],
    },
    {
        id: 'browser-report-presentation',
        title: 'Browser report classification and actions',
        command: [bun, 'test', 'tests/browser-report-presentation.test.ts'],
    },
    {
        id: 'browser-report-evidence',
        title: 'Browser report evidence contract',
        command: [bun, 'scripts/check-browser-report-evidence.mjs'],
    },
]
