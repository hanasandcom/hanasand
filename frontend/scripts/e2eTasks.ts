import { bun, type TestTask } from './testTask'

export const e2eTasks: TestTask[] = [
    {
        id: 'public-archive',
        title: 'Public archive route smoke',
        command: [bun, 'scripts/check-public-archive.mjs'],
        requires: 'server',
    },
    {
        id: 'e2e',
        title: 'Playwright full smoke',
        command: [bun, 'scripts/run-playwright-status.mjs'],
        requires: 'playwright',
    },
    {
        id: 'e2e-auth',
        title: 'Playwright auth smoke',
        command: [bun, 'scripts/run-playwright-status.mjs', 'tests/auth.spec.ts'],
        requires: 'playwright',
    },
    {
        id: 'e2e-ai',
        title: 'Playwright AI smoke',
        command: [bun, 'scripts/run-playwright-status.mjs', 'tests/ai-workspace.spec.ts'],
        env: { PLAYWRIGHT_STATUS_CHECK_NAME: 'Playwright AI workspace' },
        requires: 'playwright',
    },
]
