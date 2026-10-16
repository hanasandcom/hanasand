import { expect, test } from '@playwright/test'
import { createAiWorkspacePage } from './fixture'
import { listWorkspacePaths } from './workspacePaths'

test.setTimeout(180000)

test('AI website workbench handles browser-evidence stories without terminal-only confidence', async ({ browser, baseURL }) => {
    const stories = [
        ['not the code', 'Browser evidence first.\n<hanasand-tool>{"action":"browser_task","url":"https://example.com","captureScreenshot":true,"timeoutMs":20000}</hanasand-tool>'],
        ['cofounder open', 'Checking public preview access before claiming it works.\n<hanasand-tool>{"action":"browser_task","url":"https://example.com","timeoutMs":20000}</hanasand-tool>'],
        ['mobile is all', 'Mobile claim needs browser-visible proof, not lint-only confidence.\n<hanasand-tool>{"action":"browser_task","url":"https://example.com","captureScreenshot":true,"timeoutMs":20000}</hanasand-tool>'],
        ['proof before', 'Evidence bundle first: browser result, command output, release state, then compact summary.\n<hanasand-tool>{"action":"browser_task","url":"https://example.com","timeoutMs":20000}</hanasand-tool>'],
        ['is it live', 'Live-state check queued.\n<hanasand-tool>{"action":"browser_task","url":"https://example.com","timeoutMs":20000}</hanasand-tool>'],
        ['audit wants', 'Audit proof stays split: browser evidence, command output, release state, and reviewer handoff.'],
        ['looks off', 'I will inspect the browser-visible state before another edit.\n<hanasand-tool>{"action":"browser_task","url":"https://example.com","captureScreenshot":true,"timeoutMs":20000}</hanasand-tool>'],
        ['pricing looks', 'Checking visible pricing copy before changing the page.\n<hanasand-tool>{"action":"browser_task","url":"https://example.com","timeoutMs":20000}</hanasand-tool>'],
        ['checkout work', 'Checkout needs separate UI, test-mode, and real-credential proof.\n<hanasand-tool>{"action":"browser_task","url":"https://example.com","timeoutMs":20000}</hanasand-tool>'],
        ['looks broken', 'Naming the blocker from browser evidence.\n<hanasand-tool>{"action":"browser_task","url":"https://example.com","timeoutMs":20000}</hanasand-tool>'],
        ['screen readers', 'Checking visible labels and text before claiming accessibility.\n<hanasand-tool>{"action":"browser_task","url":"https://example.com","timeoutMs":20000}</hanasand-tool>'],
        ['no essay', 'Proof only.\n<hanasand-tool>{"action":"browser_task","url":"https://example.com","timeoutMs":20000}</hanasand-tool>'],
        ['generic stuff', 'Reading visible copy first, then targeting only what users see.\n<hanasand-tool>{"action":"browser_task","url":"https://example.com","timeoutMs":20000}</hanasand-tool>'],
        ['blank page', 'Blank-page incident check: URL, title, page errors, console, next step.\n<hanasand-tool>{"action":"browser_task","url":"https://example.com","timeoutMs":20000}</hanasand-tool>'],
        ['investor opens', 'Investor demo readiness needs public browser proof and explicit limitations.\n<hanasand-tool>{"action":"browser_task","url":"https://example.com","timeoutMs":20000}</hanasand-tool>'],
        ['next agent', 'Persist browser evidence as a tool message with link artifact for handoff.\n<hanasand-tool>{"action":"browser_task","url":"https://example.com","timeoutMs":20000}</hanasand-tool>'],
        ['screenshot it', 'Screenshot capture may be unavailable; I will still report URL, title, visible text, and errors.\n<hanasand-tool>{"action":"browser_task","url":"https://example.com","captureScreenshot":true,"timeoutMs":20000}</hanasand-tool>'],
        ['find contact', 'Checking visible support/contact cues before editing.\n<hanasand-tool>{"action":"browser_task","url":"https://example.com","timeoutMs":20000}</hanasand-tool>'],
        ['still aimed', 'Drift check: speed, proof, context, and UI clarity are still the target; remaining gap is richer screenshot evidence.'],
        ['better than terminal', 'Hanasand contrast: visible status, browser proof, artifacts, and compact handoff reduce terminal-agent ambiguity.'],
    ] as const

    const prompts = [
        'look at the page, not the code',
        'can my cofounder open it',
        'mobile is all that matters',
        'show proof before the call',
        'is it live?',
        'audit wants the proof separated',
        'something looks off',
        'pricing looks sketchy',
        'make checkout work',
        'it just looks broken',
        'people using screen readers must get this',
        'no essay, prove it',
        'this still says generic stuff',
        'customers say blank page',
        'investor opens this tonight',
        'next agent needs to see what happened',
        'screenshot it',
        'customers cannot find contact',
        'are we still aimed at the best ai coding website',
        'why is this better than terminal agents with the same complaints',
    ]

    const { context, page } = await createAiWorkspacePage({
        browser,
        baseURL,
        promptCompleteContent: 'Default browser evidence update.',
        promptResponses: stories.map(([match, content]) => ({ match, content })),
    })

    for (const [index, prompt] of prompts.entries()) {
        await test.step(`story ${981 + index}`, async () => {
            const storyContent = stories[index][1]
            await page.getByPlaceholder('Ask Hanasand AI to build, inspect, debug, scaffold, or ship something...').fill(prompt)
            await page.getByRole('button', { name: 'Send' }).click()
            await expect(page.getByText(storyContent.split('\n')[0])).toBeVisible({ timeout: 10000 })
            const toolText = expectedToolCompletionText(storyContent)
            if (toolText) {
                await expect(page.getByText(toolText).last()).toBeVisible({ timeout: 10000 })
            }
        })
    }

    await expect(page.getByText('Browser verification').first()).toBeVisible()
    await expect(page.getByText('Verification found issues').first()).toBeVisible()
    await expect(page.getByText('Preview OK').first()).toBeVisible()
    await expect(page.getByText('No screenshot').first()).toBeVisible()
    await expect(page.getByText('Fetched browser target without executing client-side JavaScript.').first()).toBeVisible()
    await expect(page.getByText('remaining gap is richer screenshot evidence')).toBeVisible()

    const lastPromptRequest = await page.evaluate(() => (window as typeof window & {
        __lastAiPromptRequest?: { messages?: { role: string, content: string }[] }
    }).__lastAiPromptRequest)
    const systemPrompt = lastPromptRequest?.messages?.find((message) => message.role === 'system')?.content || ''
    expect(systemPrompt).toContain('Use browser_task for preview/public-page checks')
    expect(systemPrompt).toContain('verify UI in browser')

    await context.close()
})

test('AI website workbench handles structured browser evidence stories quickly', async ({ browser, baseURL }) => {
    const stories = [
        ['cannot find contact', 'Checking links, buttons, and forms before editing contact visibility.\n<hanasand-tool>{"action":"browser_task","url":"https://example.com","timeoutMs":16000}</hanasand-tool>'],
        ['hierarchy feels flat', 'Heading structure first, then one visual hierarchy pass.\n<hanasand-tool>{"action":"browser_task","url":"https://example.com","timeoutMs":16000}</hanasand-tool>'],
        ['pricing is obvious', 'Pricing proof check queued: headings, links, buttons.\n<hanasand-tool>{"action":"browser_task","url":"https://example.com","timeoutMs":16000}</hanasand-tool>'],
        ['phone users only', 'Mobile readiness needs viewport evidence before a claim.\n<hanasand-tool>{"action":"browser_task","url":"https://example.com","captureScreenshot":true,"timeoutMs":16000}</hanasand-tool>'],
        ['buy fast', 'Checkout CTA audit: buttons/forms first, payment claims later.\n<hanasand-tool>{"action":"browser_task","url":"https://example.com","timeoutMs":16000}</hanasand-tool>'],
        ['screen readers matter', 'Accessibility first pass: visible labels, inputs, forms, and headings.\n<hanasand-tool>{"action":"browser_task","url":"https://example.com","timeoutMs":16000}</hanasand-tool>'],
        ['investor opens', 'Investor demo triage: title, headings, CTAs, errors, then biggest visible risk.\n<hanasand-tool>{"action":"browser_task","url":"https://example.com","timeoutMs":16000}</hanasand-tool>'],
        ['blank page', 'Blank-page evidence: status, title, text, headings, and page errors.\n<hanasand-tool>{"action":"browser_task","url":"https://example.com","timeoutMs":16000}</hanasand-tool>'],
        ['what changed', 'Proof bundle: browser structure, command output, release state, compact handoff.'],
        ['copy is generic', 'Reading visible headings and CTAs before rewriting copy.\n<hanasand-tool>{"action":"browser_task","url":"https://example.com","timeoutMs":16000}</hanasand-tool>'],
        ['can people book', 'Booking proof check: forms and buttons before saying yes.\n<hanasand-tool>{"action":"browser_task","url":"https://example.com","timeoutMs":16000}</hanasand-tool>'],
        ['vendor onboarding', 'Onboarding structure check: headings, forms, links, status cues.\n<hanasand-tool>{"action":"browser_task","url":"https://example.com","timeoutMs":16000}</hanasand-tool>'],
        ['prove it works', 'Page facts first: title, headings, links, buttons, errors.\n<hanasand-tool>{"action":"browser_task","url":"https://example.com","timeoutMs":16000}</hanasand-tool>'],
        ['screenshot', 'Screenshot may be unavailable; structured browser evidence still runs.\n<hanasand-tool>{"action":"browser_task","url":"https://example.com","captureScreenshot":true,"timeoutMs":16000}</hanasand-tool>'],
        ['click pricing', 'Pricing CTA check: pricing links/buttons before changing copy.\n<hanasand-tool>{"action":"browser_task","url":"https://example.com","timeoutMs":16000}</hanasand-tool>'],
        ['another agent', 'Persist structured browser evidence for the next agent: title, headings, links, buttons.'],
        ['looks bad', 'Inspect visible structure first, then choose one focused improvement.\n<hanasand-tool>{"action":"browser_task","url":"https://example.com","timeoutMs":16000}</hanasand-tool>'],
        ['right docs', 'Compliance docs check: headings and links before any audit claim.\n<hanasand-tool>{"action":"browser_task","url":"https://example.com","timeoutMs":16000}</hanasand-tool>'],
        ['original objective', 'Drift check: structured browser evidence improves speed, proof, context, and UI clarity; screenshots remain the gap.'],
        ['terminal agents', 'Hanasand contrast: structured browser proof and artifacts reduce scrollback, compaction, and session ambiguity.'],
    ] as const

    const prompts = [
        'customers cannot find contact',
        'the hierarchy feels flat',
        'make sure pricing is obvious',
        'phone users only',
        'people need to buy fast',
        'screen readers matter',
        'investor opens this in an hour',
        'users see a blank page',
        'client asks what changed',
        'copy is generic',
        'can people book',
        'vendor onboarding must be clear',
        'prove it works',
        'screenshot',
        'people do not click pricing',
        'another agent will continue',
        'looks bad',
        'does this show the right docs',
        'are we still on the original objective',
        'why is Hanasand better than terminal agents',
    ]

    const { context, page } = await createAiWorkspacePage({
        browser,
        baseURL,
        promptCompleteContent: 'Default structured browser evidence update.',
        promptResponses: stories.map(([match, content]) => ({ match, content })),
    })

    for (const [index, prompt] of prompts.entries()) {
        await test.step(`story ${1001 + index}`, async () => {
            const storyContent = stories[index][1]
            await page.getByPlaceholder('Ask Hanasand AI to build, inspect, debug, scaffold, or ship something...').fill(prompt)
            await page.getByRole('button', { name: 'Send' }).click()
            await expect(page.getByText(storyContent.split('\n')[0])).toBeVisible({ timeout: 10000 })
            const toolText = expectedToolCompletionText(storyContent)
            if (toolText) {
                await expect(page.getByText(toolText).last()).toBeVisible({ timeout: 10000 })
            }
        })
    }

    await expect(page.getByText('Viewport meta: present').first()).toBeVisible()
    await expect(page.getByText('Headings:').first()).toBeVisible()
    await expect(page.getByText('- Ready preview').first()).toBeVisible()
    await expect(page.getByText('Links:').first()).toBeVisible()
    await expect(page.getByText('- Contact support -> /contact').first()).toBeVisible()
    await expect(page.getByText('Buttons:').first()).toBeVisible()
    await expect(page.getByText('- Get started').first()).toBeVisible()
    await expect(page.getByText('Inputs/forms:').first()).toBeVisible()
    await expect(page.getByText('- Email address / email').first()).toBeVisible()
    await expect(page.getByText('screenshots remain the gap')).toBeVisible()

    await context.close()
})

function expectedToolCompletionText(content: string) {
    if (content.includes('"action":"scaffold_nextjs_docker"')) {
        const projectName = content.match(/"projectName":"([^"]+)"/)?.[1]
        return projectName ? `Scaffolded a Next.js + Docker workspace for ${projectName}. The workspace is attached and ready for follow-up edits.` : null
    }

    if (content.includes('"action":"create_project"')) {
        const projectName = content.match(/"projectName":"([^"]+)"/)?.[1]
        return projectName ? `Created project workspace for ${projectName}` : null
    }

    if (content.includes('"action":"run_terminal_command"')) {
        const command = content.match(/"command":"([^"]+)"/)?.[1]
        return command ? `Command: ${command}` : null
    }

    if (content.includes('"action":"http_request"')) {
        const url = content.match(/"url":"([^"]+)"/)?.[1]
        return url ? `HTTP GET ${url}` : null
    }

    if (content.includes('"action":"browser_task"')) {
        const url = content.match(/"url":"([^"]+)"/)?.[1]
        return url ? `Tool browser_task executed for URL: ${url}` : null
    }

    return null
}
