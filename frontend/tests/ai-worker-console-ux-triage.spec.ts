import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

test('AI operations dashboard keeps client workflows and live telemetry contracts', async () => {
    const page = await readFile(path.join(root, 'src/app/dashboard/system/ai/pageClient.tsx'), 'utf8')
    const telemetry = await readFile(path.join(root, 'src/app/dashboard/system/ai/useAiDashboardTelemetry.ts'), 'utf8')
    const containerHealth = await readFile(path.join(root, 'src/app/dashboard/system/ai/aiContainerHealth.tsx'), 'utf8')
    const reliability = await readFile(path.join(root, 'src/app/dashboard/system/ai/aiReliabilityCards.tsx'), 'utf8')
    const content = await readFile(path.join(root, 'src/components/gpt/content.tsx'), 'utf8')
    const client = await readFile(path.join(root, 'src/components/gpt/displayClient.tsx'), 'utf8')
    const popup = await readFile(path.join(root, 'src/components/gpt/testClientPopup.tsx'), 'utf8')

    expect(page).toContain('useGptPageState()')
    expect(page).toContain('useAiDashboardTelemetry()')
    expect(page).toContain('TestClientPopup')
    expect(page).toContain('id=\'ai-clients\'')
    expect(page).toContain('data-ai-clients')
    expect(page).toContain('href=\'/system\'')
    expect(page).toContain('/logs?service=')

    expect(telemetry).toContain('aiClientRequest(\'/ai/economics?days=30\')')
    expect(telemetry).toContain('fetch(`${config.url.api}/docker`')
    expect(telemetry).toContain('normalizeDockerTelemetry(await response.json())')
    expect(telemetry).toContain('window.setInterval(loadEconomics, 30_000)')
    expect(telemetry).toContain('window.setInterval(loadAiContainers, 30_000)')
    expect(telemetry).toContain('if (!id || !token)')
    expect(telemetry).toContain('cancelled = true')
    expect(containerHealth).toContain('data-ai-container-health')
    expect(containerHealth).toContain('data-ai-container-row')
    expect(reliability).toContain('Time to first response')
    expect(reliability).toContain('Active and queued work')
    expect(reliability).toContain('row.status === \'queued\' || row.status === \'running\'')
    expect(reliability).toContain('No runs yet')
    expect(reliability).toContain('No work is running or waiting.')

    expect(content).not.toContain('Useful progress')
    expect(content).not.toContain('Click any client card')
    expect(client).toContain('telemetry offline')
    expect(client).toContain('no telemetry')

    expect(popup).toContain('Test client')
    expect(popup).toContain('Current tokens')
    expect(popup).toContain('Generated tokens')
    expect(popup).toContain('ErrorNotice')
    expect(popup).not.toMatch(/rounded-(?:xl|2xl|3xl)/)
})
