import { expect, type BrowserContext, type Locator, type Page } from '@playwright/test'

type ShareApiOptions = { fallbackId: string; initialContent?: string }

export async function addLocalAuthCookies(context: BrowserContext, baseURL: string | undefined) {
    const cookieUrl = baseURL || 'http://127.0.0.1:3000'
    const hostname = new URL(cookieUrl).hostname
    if (hostname !== '127.0.0.1' && hostname !== 'localhost') return
    await context.addCookies([
        { name: 'access_token', value: encodeURIComponent('playwright-token'), url: cookieUrl },
        { name: 'id', value: 'playwright-user', url: cookieUrl },
    ])
}

export async function openWorkspaceChat(page: Page) {
    await page.getByRole('button', { name: 'Open workspace chat' }).click()
    await expect(page.getByText('AI assistant')).toBeVisible({ timeout: 5000 })
}

export async function openWorkspaceBuildPrompt(page: Page) {
    const promptBox = page.getByPlaceholder('Describe what you want to build or change...')
    if (await promptBox.isVisible().catch(() => false)) return promptBox
    const chatButton = page.getByRole('button', { name: 'Open workspace chat' })
    await expect(chatButton).toBeVisible({ timeout: 8000 })
    await chatButton.click({ force: true })
    await page.getByRole('button', { name: 'Build' }).click()
    try {
        await expect(promptBox).toBeVisible({ timeout: 1200 })
    } catch {
        await chatButton.press('Enter')
    }
    await expect(promptBox).toBeVisible({ timeout: 5000 })
    return promptBox
}

export async function syncShareChatPromptFallback(page: Page, promptBox: Locator, prompt: string) {
    await page.locator('input[name="shareChatPromptFallback"]').evaluate((element, value) => {
        (element as HTMLInputElement).value = value
    }, prompt)
    await promptBox.dispatchEvent('input')
}

export async function mockShareApi(page: Page, { fallbackId, initialContent = '' }: ShareApiOptions) {
    await page.route('**/api/share', async route => {
        const body = route.request().postDataJSON() as { id?: string; path?: string; name?: string; content?: string; type?: string }
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
            id: body.id || fallbackId, alias: body.path || body.name || body.id || fallbackId,
            path: body.path || body.name || body.id || fallbackId, content: body.content || '',
            owner: 'playwright-user', parent: '', type: body.type || 'folder', tree: [],
        }) })
    })
    await page.route(/.*\/api\/share\/.+/, async route => {
        const shareId = route.request().url().split('/').pop() || fallbackId
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
            id: shareId, alias: shareId, path: shareId, content: initialContent,
            owner: 'playwright-user', parent: '', type: 'file',
        }) })
    })
}
