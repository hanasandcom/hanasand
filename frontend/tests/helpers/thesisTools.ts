import { expect, type BrowserContext, type Page } from '@playwright/test'

export const thesisToolsTable = '| Task | Hours | Notes |\n| --- | --- | --- |\n| First | 1 | One |\n| Second | 2 | Two |\n'

const sheets = [
    { id: 'timetable', name: 'Timetable', title: '# Timetable', body: thesisToolsTable },
    { id: 'plan', name: 'Plan', title: '# Plan', body: thesisToolsTable },
]

export function encodeThesisWorkspace(items: typeof sheets) {
    const metadata = items.map(({ body, ...sheet }) => ({ ...sheet, length: body.length }))
    const header = '<!-- thesis-workspace:2 ' + encodeURIComponent(JSON.stringify(metadata)).replace(/-/g, '%2D') + ' -->\n'
    return header + items.map(sheet => sheet.body).join('\n\n')
}

export async function prepareThesisTools(page: Page, context: BrowserContext, baseURL: string | undefined) {
    expect(baseURL).toBe('http://127.0.0.1:3205')
    await context.addCookies([
        { name: 'id', value: 'eirikhanasand', url: baseURL! },
        { name: 'access_token', value: 'synthetic-owner', url: baseURL! },
    ])
    await context.addInitScript(() => {
        const NativeSocket = window.WebSocket
        window.WebSocket = class extends NativeSocket {
            constructor(url: string | URL, protocols?: string | string[]) {
                const target = String(url).endsWith('/api/ws/thesis')
                    ? 'ws://127.0.0.1:3202/api/ws/thesis'
                    : url
                super(target, protocols)
            }
        }
    })

    const current = await (await context.request.get(baseURL + '/api/thesis')).json()
    const seeded = await context.request.put(baseURL + '/api/thesis', {
        headers: { Origin: baseURL! },
        data: { ...current, title: '# Timetable', body: encodeThesisWorkspace(sheets) },
    })
    expect(seeded.ok()).toBe(true)
    await page.goto('/thesis')
    await expect(page.getByRole('button', { name: 'Insert table', exact: true })).toBeVisible()
}
