import { expect, type Browser } from '@playwright/test'
import { installAiApiRoutes } from './apiRoutes'
import { installAiSocketMock } from './socketMock'
import { installShareRoutes } from './shareRoutes'
import type { ShareEntry } from './types'

export async function createAiWorkspacePage({ browser, baseURL, promptCompleteContent, promptResponses = [], modelConnected = true }: {
    browser: Browser
    baseURL: string | undefined
    promptCompleteContent: string
    promptResponses?: { match: string, content: string }[]
    modelConnected?: boolean
}) {
    const shareState = new Map<string, ShareEntry>()
    const treeChildren = new Map<string, string[]>()
    let vmName = ''
    const cookieDomain = new URL(baseURL || 'http://127.0.0.1:3000').hostname
    const context = await browser.newContext({ baseURL })
    await context.addCookies([
        { name: 'id', value: 'playwright-user', domain: cookieDomain, path: '/' },
        { name: 'access_token', value: encodeURIComponent('playwright-token'), domain: cookieDomain, path: '/' },
    ])
    await installAiSocketMock(context, { promptCompleteContent, promptResponses, modelConnected })
    const page = await context.newPage()
    await installAiApiRoutes(page, (nextName) => { vmName = nextName })
    await installShareRoutes(page, shareState, treeChildren)
    await page.goto('/ai')
    await expect(page.getByPlaceholder('Ask Hanasand AI to build, inspect, debug, scaffold, or ship something...')).toBeVisible()
    await expect(page.getByText('No repository is attached yet.')).toBeVisible()
    await expect(page.getByText('Starter', { exact: true })).toBeVisible()
    await expect(page.getByText('Deploy', { exact: true })).toBeVisible()
    if (modelConnected) {
        await expect(page.getByRole('button', { name: 'local-32b' })).toBeVisible({ timeout: 15000 })
    } else {
        await expect(page.getByRole('button', { name: 'No model connected' })).toBeVisible({ timeout: 15000 })
        await expect(page.getByText('Offline', { exact: true })).toBeVisible()
        await expect(page.getByText('Ready', { exact: true })).toHaveCount(0)
    }
    return { context, page, shareState, treeChildren, getVmName: () => vmName }
}
