import { bun, type TestTask } from './testTask'

export const authOrganizationTasks: TestTask[] = [
    { id: 'auth-register-flow', title: 'Registration and verification flow', command: [bun, 'test', 'tests/register-flow.test.ts'] },
    { id: 'auth-request-body', title: 'Shared login and registration body parsing', command: [bun, 'test', 'tests/auth-request-body.test.ts'] },
    { id: 'auth-passkey-ui', title: 'Passkey authentication UI contracts', command: [bun, 'test', 'tests/passkey-auth-ui.test.ts'] },
    { id: 'auth-sso-redirects', title: 'SSO public and internal redirect policy', command: [bun, 'test', 'tests/sso-redirects.test.ts'] },
    { id: 'auth-passkey-proxy', title: 'Passkey route forwarding contracts', command: [bun, 'test', 'tests/passkey-proxy-routes.test.ts'] },
    { id: 'auth-reserved-user', title: 'Reserved user visibility rules', command: [bun, 'test', 'tests/reserved-user-visibility.test.ts'] },
    { id: 'organization-retention-privacy', title: 'Organization retention privacy controls', command: [bun, 'test', 'tests/organization-retention-privacy.test.mjs'] },
    { id: 'organization-watchlist-dwm-bridge', title: 'Organization watchlist DWM mirror behavior', command: [bun, 'test', 'tests/organization-watchlist-dwm-bridge.test.ts'] },
    { id: 'organization-watchlist-dwm-payload', title: 'Organization watchlist DWM payload projection', command: [bun, 'test', 'tests/organization-watchlist-dwm-payload.test.ts'] },
    { id: 'organization-watchlist-proxy', title: 'Organization watchlist proxy auth and forwarding', command: [bun, 'test', 'tests/organization-watchlist-proxy.test.ts'] },
    { id: 'organization-workspace-tenant-switching', title: 'Organization workspace tenant switching', command: [bun, 'test', 'tests/organization-workspace-tenant-switching.test.ts'] },
    { id: 'organization-page-data-contract', title: 'Organization page bundle request map', command: [bun, 'test', 'tests/organization-page-data-contract.test.ts'] },
    { id: 'management-organization-list', title: 'Management organization list rendering', command: [bun, 'test', 'tests/management-organization-list.test.tsx'] },
    { id: 'management-organizations', title: 'Management organization navigation contract', command: [bun, 'test', 'tests/management-organizations.test.ts'] },
    { id: 'dashboard-admin-boundary', title: 'Organization-gated internal dashboard pages', command: [bun, 'test', 'tests/dashboard-admin-boundary.test.ts'] },
]
