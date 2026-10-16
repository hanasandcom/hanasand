import { expect, test as base, type Browser, type Page } from '@playwright/test'
import { startManagementApp, type ManagementApp } from './management-impersonation-app'
import { startMockImpersonationApi, type ImpersonationRequest, type MockImpersonationApi } from './management-impersonation-api'

type ImpersonationHarness = MockImpersonationApi & { appBase: string }

export const test = base.extend<object, { impersonationHarness: ImpersonationHarness }>({
    impersonationHarness: [async ({ browser }, use) => {
        void browser
        const api = await startMockImpersonationApi()
        let app: ManagementApp | undefined
        try {
            app = await startManagementApp(process.cwd(), api.apiBase)
            await use({ ...api, appBase: app.appBase })
        } finally {
            if (app) await app.close()
            await api.close()
        }
    }, { scope: 'worker' }],
})

export { expect }
export type { ImpersonationRequest }

export async function openManagementPage(browser: Browser, harness: ImpersonationHarness, touch = false) {
    const context = await browser.newContext({ baseURL: harness.appBase, ...(touch ? {
        hasTouch: true,
        isMobile: true,
        viewport: { width: 390, height: 844 },
    } : {}) })
    const expires = Math.floor(Date.now() / 1000) + 3600
    await context.addCookies([
        { name: 'id', value: 'admin-user', url: harness.appBase, expires, sameSite: 'Lax' },
        { name: 'name', value: encodeURIComponent('Admin User'), url: harness.appBase, expires, sameSite: 'Lax' },
        { name: 'access_token', value: 'admin-token', url: harness.appBase, expires, sameSite: 'Lax' },
    ])
    const page = await context.newPage()
    await page.goto('/management/users', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: 'Users', exact: true })).toBeVisible()
    await expect(page.getByText('Target User')).toBeVisible()
    return { context, page }
}

export async function openImpersonationPrompt(page: Page) {
    await page.getByRole('button', { name: 'Actions for target-user', exact: true }).click()
    const button = page.getByRole('button', { name: 'Impersonate target-user' })
    const prompt = page.getByRole('form', { name: 'Impersonation reason for target-user' })
    await expect(button).toBeVisible()
    await button.click()
    if (!await prompt.isVisible().catch(() => false)) {
        await page.waitForTimeout(250)
        await button.click()
    }
    await expect(prompt).toBeVisible()
    return prompt
}
