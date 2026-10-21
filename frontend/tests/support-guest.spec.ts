import { expect, test } from '@playwright/test'
import { mockSupportLive, supportSnapshot } from './support-fixture'

type Message = { id: string; sender_kind: string; sender_name: string; body: string; request_id?: string }

for (const expiredSession of [false, true]) {
    test(`full support page allows human support without login (expired session: ${expiredSession})`, async ({ page, baseURL }) => {
        await page.setViewportSize({ width: expiredSession ? 1440 : 390, height: 844 })
        if (expiredSession) await page.context().addCookies([{ name: 'id', value: 'expired', url: baseURL! }, { name: 'access_token', value: 'expired', url: baseURL! }])
        await page.route('**/api/backend/support/tickets', route => route.fulfill({ status: 401, json: { error: 'Unauthorized' } }))
        let channel = 'ai'
        const messages: Message[] = []
        await page.route('**/api/support/chat*', async route => {
            if (route.request().method() === 'POST') {
                const body = route.request().postDataJSON()
                expect(body.handoff).toBe(true)
                channel = 'human'
                messages.push({ id: body.requestId, sender_kind: 'user', sender_name: 'You', body: body.message })
            }
            await route.fulfill({ json: { ...supportSnapshot(messages, channel), accepted: true } })
        })
        await mockSupportLive(page)
        await page.goto('/support')
        await expect(page.getByRole('heading', { name: 'What can we help with?' })).toBeVisible()
        await expect(page.getByRole('link', { name: 'Sign in to support' })).toHaveCount(0)
        await page.getByRole('button', { name: 'Talk to a human', exact: true }).click()
        await expect(page.getByText('Waiting for support.')).toBeVisible()
        await page.reload()
        await expect(page.getByText('Waiting for support.')).toBeVisible()
        expect(new URL(page.url()).pathname).toBe('/support')
        const panel = page.getByRole('region', { name: 'Guest support', exact: true })
        expect(await panel.evaluate(el => el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight)).toBe(true)
        await expect(panel.getByLabel('Message', { exact: true })).toBeVisible()
        await page.screenshot({ path: `/tmp/support-guest-full-${expiredSession ? 'expired' : 'anonymous'}.png` })
    })
}
