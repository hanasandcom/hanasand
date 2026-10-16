import type { Page } from '@playwright/test'

export const shareCreateUrl = '**/api/share*'
const syncAgentTargetUrl = /\/api\/vm\/[^/]+\/agent-target\/sync-access$/
const getAgentTargetUrl = /\/api\/vm\/[^/]+\/agent-target$/

export function isShareCreateUrl(url: string) {
    return url.includes('/api/share')
}

export async function mockProjectAgentTarget(page: Page, vmName: string) {
    await page.route(syncAgentTargetUrl, route => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
            ok: true,
            vmName,
            scope: 'current_user',
            triggeredBy: 'playwright-user',
            syncedUserIds: ['playwright-user'],
            certificateCount: 1,
            received: 1,
            added: 1,
            total: 1,
            updatedAt: new Date().toISOString(),
            notes: [],
        }),
    }))
    await page.route(getAgentTargetUrl, route => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
            name: vmName,
            capabilities: { canConnect: true },
            network: { sshHost: '127.0.0.1' },
        }),
    }))
}

export async function openShareMetadata(page: Page) {
    await page.waitForFunction(() => {
        const button = document.querySelector('[aria-label="Open share metadata"]') as HTMLButtonElement | null
        return Boolean(button?.onclick)
    })
    await page.evaluate(() => {
        document
            .querySelector('[aria-label="Open share metadata"]')
            ?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))
    })
}
