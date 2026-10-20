import { expect, test } from '@playwright/test'
import { mockSupportLive } from './support-fixture'

test('signed-in homepage chat starts a session, sends a message and fits a small screen', async ({ page, baseURL }) => {
    await page.setViewportSize({ width: 320, height: 568 })
    await page.context().addCookies([
        { name: 'id', value: 'customer', url: baseURL! },
        { name: 'access_token', value: 'local-test', url: baseURL! },
    ])
    let sessionStarted = 0
    let authenticatedChatRequest = false
    const messages: { id: string; sender_kind: string; sender_name: string; body: string }[] = []
    await page.route('**/api/support/chat*', async route => {
        const headers = await route.request().allHeaders()
        authenticatedChatRequest ||= headers.authorization === 'Bearer local-test'
        if (route.request().method() === 'POST') {
            const body = route.request().postDataJSON()
            if (body.message) {
                messages.push({ id: 'question', sender_kind: 'user', sender_name: 'You', body: body.message })
                messages.push({ id: 'answer', sender_kind: 'assistant', sender_name: 'Hanasand AI', body: 'I can help with that.' })
            }
        }
        await route.fulfill({ json: { channel: 'ai', status: 'open', pending: false, messages } })
    })
    await mockSupportLive(page)
    await page.route('**/api/support/session', async route => {
        sessionStarted += 1
        await route.fulfill({ status: 204 })
    })
    await page.goto('/')
    await page.getByLabel('Open support assistant', { exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Support assistant' })
    await expect(dialog.getByRole('heading', { name: 'What can we help with?' })).toBeVisible()
    await expect.poll(() => sessionStarted).toBe(1)
    await expect.poll(() => authenticatedChatRequest).toBe(true)
    const box = (await dialog.boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.y).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(320)
    expect(box.y + box.height).toBeLessThanOrEqual(568)
    const input = dialog.getByLabel('Message', { exact: true })
    await expect(input).toBeVisible()
    await input.fill('I need help with my account.')
    await dialog.getByLabel('Send message', { exact: true }).click()
    await expect(dialog.getByRole('log')).toContainText('I can help with that.')
})
