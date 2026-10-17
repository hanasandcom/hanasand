import type { Page } from '@playwright/test'

export const shareCreateUrl = '**/api/share*'

export function isShareCreateUrl(url: string) {
    return url.includes('/api/share')
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
