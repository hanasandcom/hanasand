import { expect, test } from '@playwright/test'

test('one unsent AI chat draft stays hidden and restores its message after navigation', async ({ page }) => {
    await page.goto('/ai', { waitUntil: 'networkidle' })

    const composer = page.getByRole('textbox', { name: 'Message' })
    await expect(composer).toBeVisible()
    await page.getByRole('button', { name: 'New chat' }).click()
    await composer.fill('Keep this first message as a local draft.')
    const firstDraftId = await page.evaluate(() => {
        const draft = localStorage.getItem('hanasand.ai.pendingConversationDraft')
        return draft ? JSON.parse(draft).conversation.id as string : null
    })

    await page.getByRole('button', { name: 'New chat' }).click()
    await expect(composer).toHaveValue('Keep this first message as a local draft.')
    await expect(page.getByText('No active sessions yet.')).toBeVisible()
    const reusedDraftId = await page.evaluate(() => {
        const draft = localStorage.getItem('hanasand.ai.pendingConversationDraft')
        return draft ? JSON.parse(draft).conversation.id as string : null
    })
    expect(reusedDraftId).toBe(firstDraftId)

    await page.goto('/about', { waitUntil: 'domcontentloaded' })
    await page.goto('/ai', { waitUntil: 'networkidle' })
    await expect(composer).toHaveValue('Keep this first message as a local draft.')
    await expect(page.getByText('No active sessions yet.')).toBeVisible()
    const restoredDraftId = await page.evaluate(() => {
        const draft = localStorage.getItem('hanasand.ai.pendingConversationDraft')
        return draft ? JSON.parse(draft).conversation.id as string : null
    })
    expect(restoredDraftId).toBe(firstDraftId)
})
