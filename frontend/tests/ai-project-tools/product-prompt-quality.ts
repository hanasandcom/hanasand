import { expect, test } from '@playwright/test'
import { createAiWorkspacePage } from './fixture'
import { expectedToolCompletionText } from './toolCompletionText'

test.setTimeout(180000)

test('AI website workbench handles stricter ambiguous product-building stories without hiding the tools', async ({ browser, baseURL }) => {
    const stories = [
        ['motion designer', 'Portfolio direction set.\n<hanasand-tool>{"action":"scaffold_nextjs_docker","projectName":"Motion Designer Portfolio"}</hanasand-tool>'],
        ['uptime product', 'Waitlist shell ready.\n<hanasand-tool>{"action":"scaffold_nextjs_docker","projectName":"Uptime Waitlist"}</hanasand-tool>'],
        ['restaurant booking', 'Booking preview path chosen.\n<hanasand-tool>{"action":"create_project","projectName":"Restaurant Booking Preview","vmName":"restaurant-preview"}</hanasand-tool>'],
        ['compliance dashboard', 'Enterprise dashboard skeleton created.\n<hanasand-tool>{"action":"scaffold_nextjs_docker","projectName":"Vendor Compliance Dashboard"}</hanasand-tool>'],
        ['repo is broken', 'I need the repository URL or owner/name to import it; then I will inspect env and config before editing.'],
        ['cramped on mobile', 'Responsive pass started.\n<hanasand-tool>{"action":"run_terminal_command","command":"npm run lint","timeoutMs":12000}</hanasand-tool>'],
        ['pricing page', 'Pricing page workspace ready.\n<hanasand-tool>{"action":"scaffold_nextjs_docker","projectName":"Pricing Page"}</hanasand-tool>'],
        ['reviewers to understand', 'Review handoff should stay visible in Workspace, Ownership, Deploy, and Release history before the summary.'],
        ['meeting notes product', 'Demo shell workspace ready.\n<hanasand-tool>{"action":"scaffold_nextjs_docker","projectName":"Meeting Notes Demo"}</hanasand-tool>'],
        ['actually run', 'Checking the attached workspace now.\n<hanasand-tool>{"action":"run_terminal_command","command":"pwd && ls","timeoutMs":8000}</hanasand-tool>'],
        ['handmade lamps', 'Product page workspace ready.\n<hanasand-tool>{"action":"scaffold_nextjs_docker","projectName":"Handmade Lamps Product Page"}</hanasand-tool>'],
        ['docker compose', 'Docker check queued.\n<hanasand-tool>{"action":"run_terminal_command","command":"docker compose config","timeoutMs":12000}</hanasand-tool>'],
        ['schools and teachers', 'Admin prototype workspace ready.\n<hanasand-tool>{"action":"scaffold_nextjs_docker","projectName":"School Admin Prototype"}</hanasand-tool>'],
        ['norwegian coffee', 'Campaign workspace ready.\n<hanasand-tool>{"action":"scaffold_nextjs_docker","projectName":"Norwegian Coffee Campaign"}</hanasand-tool>'],
        ['prod db', 'I cannot connect to or mutate production data from a vague prompt. Share a staging export or migration goal and I will build the safe review path first.'],
        ['angry tickets', 'Support triage board workspace ready.\n<hanasand-tool>{"action":"scaffold_nextjs_docker","projectName":"Support Triage Board"}</hanasand-tool>'],
        ['book shoots', 'Booking funnel workspace ready.\n<hanasand-tool>{"action":"scaffold_nextjs_docker","projectName":"Photography Booking Funnel"}</hanasand-tool>'],
        ['less templatey', 'I will make the current workspace more editorial, keep the conversion path, and verify the result.\n<hanasand-tool>{"action":"run_terminal_command","command":"npm run lint","timeoutMs":12000}</hanasand-tool>'],
        ['preview link', 'Preview healthcheck requested.\n<hanasand-tool>{"action":"http_request","url":"https://example.com","method":"GET"}</hanasand-tool>'],
        ['homepage', 'Homepage fix path: edit, check, summarize compactly.\n<hanasand-tool>{"action":"run_terminal_command","command":"npm run lint","timeoutMs":12000}</hanasand-tool>'],
    ] as const

    const prompts = [
        'make me a sharp little portfolio for a motion designer, dark but not boring, with a case study and contact.',
        'i need a landing page for an uptime product. make it feel legit and collect emails somehow.',
        'client needs a preview by lunch for a restaurant booking site, not a blog.',
        'mock an internal compliance dashboard for vendors. should look enterprise, not startup toy.',
        'my repo is broken after i changed env stuff, can you look?',
        'this page feels cramped on mobile. make it breathe but keep the desktop dense.',
        'pricing page please. make the middle plan sell without being cheesy.',
        'we need reviewers to understand what changed and who deployed it.',
        'build a realistic ai meeting notes product demo, but no login yet.',
        'does this app actually run? check it, don\'t just say it should.',
        'make a premium product page for handmade lamps, needs variants and shipping info.',
        'docker compose is annoying here, make it deployable.',
        'prototype the admin area for managing schools and teachers.',
        'we\'re launching a norwegian coffee thing, make a campaign page with signup.',
        'connect to our prod db and fix the users table.',
        'make a customer support triage board for angry tickets.',
        'i need people to book shoots and see packages, make it classy.',
        'less templatey, more editorial, but still converts.',
        'ship a preview link my cofounder can open.',
        'fix the homepage and don\'t write me an essay.',
    ]

    const { context, page } = await createAiWorkspacePage({
        browser,
        baseURL,
        promptCompleteContent: 'Default compact progress update.',
        promptResponses: stories.map(([match, content]) => ({ match, content })),
    })

    await expect(page.getByText('No workspace attached')).toBeVisible()
    await expect(page.getByText('Review handoff', { exact: true })).toBeVisible()
    await expect(page.getByText('Release history', { exact: true })).toBeVisible()
    await expect(page.getByText('Create Next.js + Docker workspace')).toBeVisible()
    await expect(page.getByText('Start VM deploy check')).toBeVisible()

    for (const [index, prompt] of prompts.entries()) {
        await test.step(`story ${901 + index}`, async () => {
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

    const lastPromptRequest = await page.evaluate(() => (window as typeof window & {
        __lastAiPromptRequest?: { messages?: { role: string, content: string }[] }
    }).__lastAiPromptRequest)
    const systemPrompt = lastPromptRequest?.messages?.find((message) => message.role === 'system')?.content || ''
    expect(systemPrompt).toContain('Optimize for fast product progress')
    expect(systemPrompt).toContain('Keep visible replies compact')
    expect(systemPrompt).toContain('scaffold or attach workspace -> implement files -> run a focused terminal check -> verify UI in browser')

    await expect(page.getByText(/Scaffolded a Next\.js \+ Docker workspace/).first()).toBeVisible()
    await expect(page.getByText(/Ran terminal command on share/).first()).toBeVisible()
    await expect(page.getByText(/HTTP GET https:\/\/example\.com/).first()).toBeVisible()
    await expect(page.getByText('I cannot connect to or mutate production data from a vague prompt.')).toBeVisible()

    await context.close()
})

test('AI website workbench handles accessibility, messy scope, and evidence pressure stories', async ({ browser, baseURL }) => {
    const stories = [
        ['unlabeled button', 'Workbench controls are named: search chats, open editor, and repository details are keyboard-readable.'],
        ['where do i see the files', 'Use the Editor link to inspect files; attached workspaces also show project files in the details rail.'],
        ['too gray', 'Art direction workspace ready: warmer contrast, sharper hierarchy, premium without fintech gloss.\n<hanasand-tool>{"action":"scaffold_nextjs_docker","projectName":"Premium Visual Direction"}</hanasand-tool>'],
        ['rent tools nearby', 'Nearby tool rental MVP ready: listings, search, availability request, and owner contact.\n<hanasand-tool>{"action":"scaffold_nextjs_docker","projectName":"Nearby Tool Rental Marketplace"}</hanasand-tool>'],
        ['legal should only comment', 'Legal should be reviewer-only; engineering can be editor. Keep review handoff visible.'],
        ['looks like a template', 'Template rescue workspace ready: keep the offer, change visual system, then verify.\n<hanasand-tool>{"action":"scaffold_nextjs_docker","projectName":"Brand Rescue Workspace"}</hanasand-tool>'],
        ['public or private', 'Exposure lives in Deploy and Release history. If missing, run a deploy healthcheck before claiming public access.'],
        ['test broke', 'Running the check first; no guessing.\n<hanasand-tool>{"action":"run_terminal_command","command":"npm test","timeoutMs":20000}</hanasand-tool>'],
        ['add login', 'I can build an auth-shaped demo UI now, but real authentication needs configured backend/session handling.\n<hanasand-tool>{"action":"scaffold_nextjs_docker","projectName":"Auth Demo Shell"}</hanasand-tool>'],
        ['housing help', 'Accessible housing support service page ready.\n<hanasand-tool>{"action":"scaffold_nextjs_docker","projectName":"Housing Help Service"}</hanasand-tool>'],
        ['sell my presets', 'Preset storefront skeleton ready with licensing and honest checkout placeholder.\n<hanasand-tool>{"action":"scaffold_nextjs_docker","projectName":"Preset Storefront"}</hanasand-tool>'],
        ['refunds, bugs, chaos', 'Support chaos dashboard ready with refunds, bugs, SLA, and severity triage.\n<hanasand-tool>{"action":"scaffold_nextjs_docker","projectName":"Support Chaos Dashboard"}</hanasand-tool>'],
        ['prod secrets', 'Do not paste production secrets into chat. Use env vars or a managed secret path.'],
        ['metrics look good', 'I will label metrics as demo/sample unless you provide verified numbers.'],
        ['look at it, not the code', 'Browser-first visual review needs a workspace first, so I am creating one before screenshot evidence.\n<hanasand-tool>{"action":"scaffold_nextjs_docker","projectName":"Visual Review Workspace"}</hanasand-tool>'],
        ['another agent taking over', 'Continuity path: record changed files, checks, release state, and next steps in the visible workbench.'],
        ['is it stuck', 'Status should distinguish Offline, Thinking, Ready, Tool complete, and Tool error without mixed signals.'],
        ['iphone', 'Mobile proof workspace ready; verify the narrow viewport or name the blocker next.\n<hanasand-tool>{"action":"scaffold_nextjs_docker","projectName":"Mobile Proof Workspace"}</hanasand-tool>'],
        ['booking, payments, crm, and ads', 'Scope cut: build booking first, stub payments honestly, defer CRM and ads until the first workflow works.\n<hanasand-tool>{"action":"scaffold_nextjs_docker","projectName":"Booking First Workflow"}</hanasand-tool>'],
        ['show evidence', 'Evidence-first summary: changed surface, check output, and artifact links before commentary.\n<hanasand-tool>{"action":"run_terminal_command","command":"pwd && ls","timeoutMs":8000}</hanasand-tool>'],
    ] as const

    const prompts = [
        'i only tab around. what does this unlabeled button do?',
        'where do i see the files?',
        'too gray. make it feel expensive but not fintech.',
        'marketplace idea, dunno, people rent tools nearby',
        'legal should only comment, eng can edit',
        'client says it looks like a template. fix that.',
        'is preview public or private rn?',
        'test broke. stop guessing.',
        'add login but don\'t make me deal with auth yet',
        'people need to apply for housing help. make it simple.',
        'sell my presets. fast.',
        'angry customers, refunds, bugs, chaos. dashboard.',
        'i can paste prod secrets if easier',
        'make metrics look good',
        'look at it, not the code',
        'will this survive another agent taking over?',
        'is it stuck?',
        'client only checks on iphone.',
        'make booking, payments, crm, and ads today',
        'less talk. show evidence.',
    ]

    const { context, page } = await createAiWorkspacePage({
        browser,
        baseURL,
        promptCompleteContent: 'Default compact ambiguity update.',
        promptResponses: stories.map(([match, content]) => ({ match, content })),
    })

    await expect(page.getByRole('button', { name: 'Search chats' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Open editor' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Hide repository details' })).toBeVisible()

    await page.getByRole('button', { name: 'Hide repository details' }).click()
    await expect(page.getByRole('button', { name: 'Show repository details' })).toBeVisible()
    await page.getByRole('button', { name: 'Show repository details' }).click()
    await expect(page.getByText('No workspace attached')).toBeVisible()

    for (const [index, prompt] of prompts.entries()) {
        await test.step(`story ${941 + index}`, async () => {
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

    await expect(page.getByText('Do not paste production secrets into chat.')).toBeVisible()
    await expect(page.getByText('I will label metrics as demo/sample')).toBeVisible()
    await expect(page.getByText('Scope cut: build booking first')).toBeVisible()
    await expect(page.getByText('Tool complete').first()).toBeVisible()

    const lastPromptRequest = await page.evaluate(() => (window as typeof window & {
        __lastAiPromptRequest?: { messages?: { role: string, content: string }[] }
    }).__lastAiPromptRequest)
    const systemPrompt = lastPromptRequest?.messages?.find((message) => message.role === 'system')?.content || ''
    expect(systemPrompt).toContain('Do not run terminal, read_share, or update_share tools before a workspace is attached')

    await context.close()
})
