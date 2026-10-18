import { expect, test } from '@playwright/test'
import { fulfillAiReply } from './fulfillAiReply'
import { addLocalAuthCookies, mockShareApi, openWorkspaceBuildPrompt, syncShareChatPromptFallback } from './helpers'

test.describe.configure({ mode: 'serial' })
test.setTimeout(300_000)

test('share page AI queues browser proof asynchronously before apply gating', async ({ page, context, baseURL }) => {
    test.setTimeout(60_000)
    await addLocalAuthCookies(context, baseURL)

    await mockShareApi(page, { fallbackId: 'app-async-proof', initialContent: 'export default function Page() { return <main><h1>Before</h1></main> }' })

    await page.route('**/api/backend/tools/ai', async (route) => {
        await fulfillAiReply(route, {
            message: [
                'Prepared async proof change.',
                '<hanasand-tool>{"action":"browser_task","url":"https://hanasand.com/s/app-async-proof","captureScreenshot":true,"timeoutMs":16000}</hanasand-tool>',
                '<hanasand-tool>{"action":"upsert_share","path":"src/app/page.tsx","content":"export default function Page() { return <main><h1>After async proof</h1></main> }"}</hanasand-tool>',
            ].join('\n'),
        })
    })

    let verificationJobStarted = false
    const verificationJobs = new Map<string, { kind: string, targetUrl: string }>()
    await page.route(/.*\/api\/backend\/tools\/verification-jobs.*/, async (route) => {
        const request = route.request()
        const url = request.url()
        if (request.method() === 'POST') {
            const body = request.postDataJSON() as { kind?: string, targetUrl?: string }
            const kind = body.kind || 'browser'
            const id = `proof-${kind}-${verificationJobs.size + 1}`
            verificationJobs.set(id, { kind, targetUrl: body.targetUrl || 'https://hanasand.com/s/app-async-proof' })
            if (kind === 'browser') {
                verificationJobStarted = true
            }
            await route.fulfill({
                status: 202,
                contentType: 'application/json',
                body: JSON.stringify({
                    job: {
                        id,
                        kind,
                        status: 'queued',
                        currentStep: 'Queued',
                        targetUrl: body.targetUrl,
                        artifacts: [],
                    },
                }),
            })
            return
        }

        const id = url.split('/').pop() || ''
        const job = verificationJobs.get(id)
        if (job?.kind === 'browser') {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    job: {
                        id,
                        kind: 'browser',
                        status: 'completed',
                        currentStep: 'Completed',
                        targetUrl: job.targetUrl,
                        artifacts: [{
                            type: 'browser_result',
                            data: {
                                url: job.targetUrl,
                                title: 'Async proof',
                                screenshotPath: '/tmp/async-proof.png',
                                structure: {
                                    headings: ['After async proof'],
                                    links: [],
                                    buttons: [],
                                    inputs: [],
                                    forms: [],
                                    hasViewportMeta: true,
                                },
                                consoleMessages: [],
                                pageErrors: [],
                            },
                        }],
                    },
                }),
            })
            return
        }

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                job: {
                    id,
                    kind: 'design',
                    status: 'completed',
                    currentStep: 'Completed',
                    targetUrl: job?.targetUrl || 'https://hanasand.com/s/app-async-proof',
                    artifacts: [{
                        type: 'design_quality_report',
                        data: { score: 92 },
                    }],
                },
            }),
        })
    })

    let browserTaskStarted = false
    await page.route('**/api/tools/browser/task', async (route) => {
        browserTaskStarted = true
        await new Promise((resolve) => setTimeout(resolve, 1200))
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                url: 'https://hanasand.com/s/app-async-proof',
                title: 'Async proof',
                screenshotPath: '/tmp/async-proof.png',
                structure: {
                    headings: ['After async proof'],
                    links: [],
                    buttons: [],
                    inputs: [],
                    forms: [],
                    hasViewportMeta: true,
                },
                consoleMessages: [],
                pageErrors: [],
            }),
        })
    })

    await page.goto('/s/app-async-proof?new=1&chat=1')
    const promptBox = await openWorkspaceBuildPrompt(page)
    await promptBox.fill('verify public page without blocking the chat')
    await syncShareChatPromptFallback(page, promptBox, 'verify public page without blocking the chat')
    await page.getByRole('button', { name: 'Send message' }).click({ force: true })

    await expect(page.getByText('Prepared async proof change.')).toBeVisible({ timeout: 2500 })
    await expect(page.getByText('Browser verification queued for 1 target. You can keep reviewing while proof runs.')).toBeVisible()
    await expect(page.getByText('Proof queued')).toBeVisible()
    await expect(page.getByText('Verification queue', { exact: true })).toBeVisible()
    await expect(page.getByText('Browser proof is queued before these changes can be applied.')).toBeVisible()
    expect(verificationJobStarted || browserTaskStarted).toBe(true)

    await expect(page.getByText('Browser proof visible for https://hanasand.com/s/app-async-proof.')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Completed', { exact: true }).first()).toBeVisible()
})
