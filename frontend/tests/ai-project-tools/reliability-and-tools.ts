import { expect, test } from '@playwright/test'
import { createAiWorkspacePage } from './fixture'
import { expectedToolCompletionText } from './toolCompletionText'

test.setTimeout(180000)

test('AI website workbench handles reliability, handoff, and low-bloat pressure stories', async ({ browser, baseURL }) => {
    const offline = await createAiWorkspacePage({
        browser,
        baseURL,
        promptCompleteContent: 'Model pool unavailable.',
        modelConnected: false,
    })
    await offline.context.close()

    const stories = [
        ['airbnb for rehearsal rooms', 'MVP scope picked: rehearsal room listings, search, availability request, and host contact.\n<hanasand-tool>{"action":"scaffold_nextjs_docker","projectName":"Rehearsal Room Marketplace"}</hanasand-tool>'],
        ['not look ai-generated', 'Visual pass: stronger hierarchy, tighter copy, less templated spacing.\n<hanasand-tool>{"action":"run_terminal_command","command":"npm run lint","timeoutMs":12000}</hanasand-tool>'],
        ['what changed and what ran', 'Proof path: use visible artifacts, changed files, command output, and release history before any claim of done.'],
        ['build broke', 'Build-first fix path.\n<hanasand-tool>{"action":"run_terminal_command","command":"npm run build","timeoutMs":20000}</hanasand-tool>'],
        ['dental clinic', 'Dental clinic workspace ready with real service, trust, booking, and emergency sections.\n<hanasand-tool>{"action":"scaffold_nextjs_docker","projectName":"Dental Clinic Website"}</hanasand-tool>'],
        ['contractor review', 'Use reviewer access for the contractor; do not grant editor rights unless the owner explicitly asks.'],
        ['finance app', 'Finance onboarding prototype ready with safe multi-step states and no fake bank connection.\n<hanasand-tool>{"action":"scaffold_nextjs_docker","projectName":"Finance Onboarding Prototype"}</hanasand-tool>'],
        ['too generic', 'Revision path: keep the offer, improve premium positioning, and verify the changed surface.\n<hanasand-tool>{"action":"run_terminal_command","command":"npm run lint","timeoutMs":12000}</hanasand-tool>'],
        ['preview is broken', 'Checking the preview endpoint and naming the blocker.\n<hanasand-tool>{"action":"http_request","url":"https://example.com","method":"GET"}</hanasand-tool>'],
        ['phone users only', 'Mobile-first course page workspace ready.\n<hanasand-tool>{"action":"scaffold_nextjs_docker","projectName":"Mobile Course Page"}</hanasand-tool>'],
        ['overdue obvious', 'SLA triage workspace ready with overdue-first states.\n<hanasand-tool>{"action":"scaffold_nextjs_docker","projectName":"SLA Ticket Dashboard"}</hanasand-tool>'],
        ['private admin endpoint', 'Do not paste private tokens into chat. Put the token in a secret or env var and I can build a safe verification harness.'],
        ['add payments', 'I can prototype pricing and checkout UI now; real payments need configured Stripe credentials before I claim they work.\n<hanasand-tool>{"action":"scaffold_nextjs_docker","projectName":"Payments Demo Prototype"}</hanasand-tool>'],
        ['failing nav', 'Focused nav fix: inspect nav files only, run the narrow check, and summarize compactly.\n<hanasand-tool>{"action":"run_terminal_command","command":"npm run lint","timeoutMs":12000}</hanasand-tool>'],
        ['childcare support', 'Accessible childcare support page workspace ready.\n<hanasand-tool>{"action":"scaffold_nextjs_docker","projectName":"Childcare Support Service"}</hanasand-tool>'],
        ['investor demo', 'Investor demo workspace ready with clearly marked traction placeholders.\n<hanasand-tool>{"action":"scaffold_nextjs_docker","projectName":"Investor Demo Page"}</hanasand-tool>'],
        ['continue this tomorrow', 'Handoff path: recent files, checks run, deploy state, and next steps stay visible in the workbench.'],
        ['screenshot it', 'Visual verification path selected; screenshot evidence should drive the next edit.\n<hanasand-tool>{"action":"run_terminal_command","command":"npm run lint","timeoutMs":12000}</hanasand-tool>'],
        ['obvious thing', 'Doing the sensible default now.\n<hanasand-tool>{"action":"run_terminal_command","command":"npm run lint","timeoutMs":12000}</hanasand-tool>'],
    ] as const

    const prompts = [
        'make the simplest version of airbnb for rehearsal rooms',
        'make this not look ai-generated',
        'before i trust this, show me what changed and what ran',
        'build broke after my last change, fix fast',
        'site for a dental clinic. no lorem ipsum.',
        'let the contractor review but not edit',
        'prototype onboarding for a finance app, has to feel safe',
        'client says too generic. make it premium but keep the same offer',
        'preview is broken. tell me the blocker not a pep talk',
        'phone users only basically. make the course page convert',
        'dashboard for tickets, make overdue obvious',
        'curl this private admin endpoint with my token: paste-token-later',
        'add payments to the demo',
        'don\'t read the whole repo, fix the failing nav',
        'page for applying for childcare support. has to be clear',
        'make the investor demo page look credible by tonight',
        'another dev needs to continue this tomorrow',
        'screenshot it and fix what looks off',
        'just do the obvious thing',
    ]

    const { context, page } = await createAiWorkspacePage({
        browser,
        baseURL,
        promptCompleteContent: 'Default compact reliability update.',
        promptResponses: stories.map(([match, content]) => ({ match, content })),
    })

    for (const [index, prompt] of prompts.entries()) {
        await test.step(`story ${922 + index}`, async () => {
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
    expect(systemPrompt).toContain('Ask a clarifying question only when the next action would be destructive')
    expect(systemPrompt).toContain('Keep visible replies compact')

    await expect(page.getByText('Tool complete').first()).toBeVisible()
    await expect(page.getByText('Do not paste private tokens into chat.')).toBeVisible()
    await expect(page.getByText('real payments need configured Stripe credentials')).toBeVisible()
    await expect(page.getByText(/HTTP GET https:\/\/example\.com/).first()).toBeVisible()

    await context.close()
})

test('AI website workbench handles terminal-contrast and blocked-state stories', async ({ browser, baseURL }) => {
    const offline = await createAiWorkspacePage({
        browser,
        baseURL,
        promptCompleteContent: 'Model pool unavailable.',
        modelConnected: false,
    })
    await offline.page.getByPlaceholder('Ask Hanasand AI to build, inspect, debug, scaffold, or ship something...').fill('hello can you make my site')
    await expect(offline.page.getByText('Model offline: connect a model lane to send prompts.')).toBeVisible()
    await expect(offline.page.getByRole('button', { name: 'Send' })).toBeDisabled()
    await offline.context.close()

    const stories = [
        ['feels cheap', 'Visual direction chosen: editorial contrast, warmer accents, sharper hierarchy.\n<hanasand-tool>{"action":"scaffold_nextjs_docker","projectName":"Taste Rescue Workspace"}</hanasand-tool>'],
        ['crm for plumbers', 'Smallest paid workflow: lead intake, quote request, job status, and invoice placeholder.\n<hanasand-tool>{"action":"scaffold_nextjs_docker","projectName":"Plumber CRM Revenue Flow"}</hanasand-tool>'],
        ['legal will ask', 'Evidence first: changed files, command output, deploy state, reviewer handoff, then short summary.'],
        ['client call in 20', 'Fast polish pass selected: hero hierarchy, proof section, CTA clarity, one focused check.\n<hanasand-tool>{"action":"scaffold_nextjs_docker","projectName":"Client Call Polish Pass"}</hanasand-tool>'],
        ['where did the stuff go', 'Open editor shows the files; workspace details shows what is attached and what changed.'],
        ['opens it on phone', 'Mobile-first workspace ready; verify the narrow viewport before claiming the fix.\n<hanasand-tool>{"action":"scaffold_nextjs_docker","projectName":"Phone First Restaurant Preview"}</hanasand-tool>'],
        ['Stripe secret', 'Do not paste Stripe secrets into chat. Use env vars or a managed secret path, then I can wire the demo safely.'],
        ['less words', 'Building first.\n<hanasand-tool>{"action":"scaffold_nextjs_docker","projectName":"Compact Build First Workspace"}</hanasand-tool>'],
        ['revenue graph', 'I will not fake verified revenue. I can build a demo-labeled chart or import real data.'],
        ['auditor can look', 'Auditor should be reviewer-only; do not grant editor/admin unless the owner explicitly asks.'],
        ['angry users', 'Refund/SLA triage workspace ready with severity, owner, escalation, and overdue states.\n<hanasand-tool>{"action":"scaffold_nextjs_docker","projectName":"Refund SLA Triage"}</hanasand-tool>'],
        ['build broke', 'Running the build first.\n<hanasand-tool>{"action":"run_terminal_command","command":"npm run build","timeoutMs":20000}</hanasand-tool>'],
        ['cofounder open it', 'Preview access needs proof: check deploy/HTTP state before claiming it is public.\n<hanasand-tool>{"action":"http_request","url":"https://example.com","method":"GET"}</hanasand-tool>'],
        ['patients need intake', 'Patient intake workspace ready with simple accessible steps and no fake compliance claim.\n<hanasand-tool>{"action":"scaffold_nextjs_docker","projectName":"Patient Intake Flow"}</hanasand-tool>'],
        ['where were we', 'Continuity summary: changed files, last tool result, release state, and next step stay visible.'],
        ['stop reading code', 'Visual QA needs a workspace first; create/attach, then inspect in browser with screenshot evidence.\n<hanasand-tool>{"action":"scaffold_nextjs_docker","projectName":"Browser Visual QA Workspace"}</hanasand-tool>'],
        ['vendor onboarding', 'Vendor onboarding admin ready with status, missing docs, owner, and audit trail.\n<hanasand-tool>{"action":"scaffold_nextjs_docker","projectName":"Vendor Onboarding Admin"}</hanasand-tool>'],
        ['sell my templates', 'Template storefront ready with licensing, preview, checkout caveat, and delivery states.\n<hanasand-tool>{"action":"scaffold_nextjs_docker","projectName":"Template Storefront"}</hanasand-tool>'],
        ['best coding website', 'Drift check: still optimizing fast autonomous builds, clear blockers, visible proof, and compact handoff. Next improvement: browser evidence tool.'],
    ] as const

    const prompts = [
        'this feels cheap, fix the taste',
        'make crm for plumbers, dunno, needs money',
        'legal will ask what happened',
        'client call in 20, make it less embarrassing',
        'where did the stuff go',
        'everyone opens it on phone',
        'I will paste the Stripe secret',
        'less words, build first',
        'make revenue graph look better',
        'auditor can look but not change',
        'angry users, refunds, too much',
        'build broke, don\'t guess',
        'can my cofounder open it',
        'patients need intake, make it easy',
        'where were we',
        'stop reading code, look at it',
        'vendor onboarding, less chaos',
        'sell my templates by tomorrow',
        'are we still building the best coding website',
    ]

    const { context, page } = await createAiWorkspacePage({
        browser,
        baseURL,
        promptCompleteContent: 'Default compact terminal-contrast update.',
        promptResponses: stories.map(([match, content]) => ({ match, content })),
    })

    await expect(page.getByText('Ready', { exact: true })).toBeVisible()
    await expect(page.getByText('Model offline: connect a model lane to send prompts.')).toHaveCount(0)

    for (const [index, prompt] of prompts.entries()) {
        await test.step(`story ${962 + index}`, async () => {
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

    await expect(page.getByText('Do not paste Stripe secrets into chat.')).toBeVisible()
    await expect(page.getByText('I will not fake verified revenue.')).toBeVisible()
    await expect(page.getByText('Auditor should be reviewer-only')).toBeVisible()
    await expect(page.getByText('Next improvement: browser evidence tool.')).toBeVisible()

    const lastPromptRequest = await page.evaluate(() => (window as typeof window & {
        __lastAiPromptRequest?: { messages?: { role: string, content: string }[] }
    }).__lastAiPromptRequest)
    const systemPrompt = lastPromptRequest?.messages?.find((message) => message.role === 'system')?.content || ''
    expect(systemPrompt).toContain('Keep visible replies compact')
    expect(systemPrompt).toContain('Do not run terminal, read_share, or update_share tools before a workspace is attached')

    await context.close()
})
