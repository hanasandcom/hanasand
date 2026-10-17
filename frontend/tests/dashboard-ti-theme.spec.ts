import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

test('enrichment page exposes evidence and source counts without confidence labels', async () => {
    const enrichment = await readFile(path.join(root, 'src/app/dashboard/ti/enrichment/page.tsx'), 'utf8')

    // The enrichment page exposes evidence/source counts rather than confidence labels.
    expect(enrichment).toContain('border-ui-border')
    expect(enrichment).toContain('text-ui-text')
    expect(enrichment).toContain('actor.sourceLinks.length')
    expect(enrichment).toContain('actor.automationEvidence.length')
    expect(enrichment).not.toContain('>Confidence</')
    expect(enrichment).not.toContain('{actor.confidence}%')
})
