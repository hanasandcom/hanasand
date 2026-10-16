import { expect, test } from '@playwright/test'
import { createAiWorkspacePage } from './fixture'
import { listWorkspacePaths } from './workspacePaths'

test.setTimeout(180000)

test('AI workspace can create a project and run a terminal command against the attached share', async ({ browser, baseURL }) => {
    const { context, page, shareState, getVmName } = await createAiWorkspacePage({
        browser,
        baseURL,
        promptCompleteContent: [
            'Preparing a remote project and verifying it from the share terminal.',
            '<hanasand-tool>{"action":"create_project","projectName":"Northstar Admin","vmName":"northstar-admin"}</hanasand-tool>',
            '<hanasand-tool>{"action":"run_terminal_command","command":"pwd && ls","timeoutMs":4000}</hanasand-tool>',
        ].join('\n\n'),
    })

    await page.getByPlaceholder('Ask Hanasand AI to build, inspect, debug, scaffold, or ship something...').fill('Create a project and verify it from the terminal.')
    await page.getByRole('button', { name: 'Send' }).click()

    await expect(page.getByText('Preparing a remote project and verifying it from the share terminal.')).toBeVisible()
    await expect(page.getByText(/Created project workspace for Northstar Admin/).first()).toBeVisible()
    await expect(page.getByText(/Ran terminal command on share/).first()).toBeVisible()
    await expect(page.getByText('/workspace/northstar-admin').first()).toBeVisible()

    const terminalCommand = await page.evaluate(() => (window as typeof window & {
        __lastTerminalCommand?: string
    }).__lastTerminalCommand || '')
    expect(getVmName()).toBe('northstar-admin')
    expect(terminalCommand).toBe('pwd && ls')
    expect([...shareState.values()].some((entry) => entry.path === 'README.md')).toBeTruthy()
    expect([...shareState.values()].some((entry) => entry.path === 'package.json')).toBeTruthy()

    await context.close()
})

test('AI workspace can scaffold a Next.js and Docker starter directly into the attached share', async ({ browser, baseURL }) => {
    const { context, page, shareState, treeChildren, getVmName } = await createAiWorkspacePage({
        browser,
        baseURL,
        promptCompleteContent: [
            'Scaffolding a Docker-ready starter directly in the attached workspace.',
            '<hanasand-tool>{"action":"scaffold_nextjs_docker","projectName":"Moonbase Console"}</hanasand-tool>',
        ].join('\n\n'),
    })

    await page.getByPlaceholder('Ask Hanasand AI to build, inspect, debug, scaffold, or ship something...').fill('Scaffold a Docker-ready Next.js workspace.')
    await page.getByRole('button', { name: 'Send' }).click()

    await expect(page.getByText('Scaffolding a Docker-ready starter directly in the attached workspace.')).toBeVisible()
    await expect(page.getByText(/Scaffolded a Next\.js \+ Docker workspace for Moonbase Console/).first()).toBeVisible()

    const rootEntry = [...shareState.values()].find((entry) => entry.type === 'folder' && entry.parent === '')
    expect(rootEntry).toBeTruthy()
    expect(rootEntry?.name).toBe('moonbase-console')
    expect(rootEntry?.path).toBe('moonbase-console')
    expect(getVmName()).toBe('')

    const workspacePaths = listWorkspacePaths({
        rootId: rootEntry!.id,
        shareState,
        treeChildren,
    })

    expect(workspacePaths).toEqual(expect.arrayContaining([
        '.dockerignore',
        '.gitignore',
        'Dockerfile',
        'README.md',
        'app',
        'app/globals.css',
        'app/layout.tsx',
        'app/page.tsx',
        'docker-compose.yml',
        'next-env.d.ts',
        'next.config.ts',
        'package.json',
        'public',
        'public/.gitkeep',
        'tsconfig.json',
    ]))

    const readmeEntry = [...shareState.values()].find((entry) => entry.name === 'README.md')
    const composeEntry = [...shareState.values()].find((entry) => entry.name === 'docker-compose.yml')
    const dockerfileEntry = [...shareState.values()].find((entry) => entry.name === 'Dockerfile')

    expect(readmeEntry?.content).toContain('# Moonbase Console')
    expect(readmeEntry?.content).toContain('HOST_PORT=3200 docker compose up --build')
    expect(composeEntry?.content).toContain('${HOST_PORT:-3000}:3000')
    expect(dockerfileEntry?.content).toContain('FROM node:20-alpine AS deps')

    await context.close()
})
