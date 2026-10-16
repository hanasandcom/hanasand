import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

test('dashboard threat intelligence tables use shared theme tokens', async () => {
    const [page, evidencePanel, sourcePanel, enrichment] = await Promise.all([
        readFile(path.join(root, 'src/app/dashboard/ti/page.tsx'), 'utf8'),
        readFile(path.join(root, 'src/app/dashboard/ti/evidenceEnrichmentPanels.tsx'), 'utf8'),
        readFile(path.join(root, 'src/app/dashboard/ti/sourceDeliveryPanels.tsx'), 'utf8'),
        readFile(path.join(root, 'src/app/dashboard/ti/enrichment/page.tsx'), 'utf8'),
    ])
    const source = `${page}\n${evidencePanel}\n${sourcePanel}`

    expect(source).toContain('Latest activity')
    expect(source).toContain('divide-ui-border')
    expect(source).toContain('text-ui-text')
    expect(source).toContain('Evidence strength')
    expect(source).toContain('evidenceStrengthLabel(actor.confidence)')

    expect(source).not.toContain('text-white')
    expect(source).not.toContain('divide-[#1f314a]')
    expect(source).not.toMatch(/\b(?:bg|text|border|divide)-\[#/)
    expect(source).not.toContain('<th className=\'px-4 py-3\'>Confidence</th>')
    expect(source).not.toContain('{actor.confidence}%')

    // The enrichment page exposes evidence/source counts rather than confidence labels.
    expect(enrichment).toContain('border-ui-border')
    expect(enrichment).toContain('text-ui-text')
    expect(enrichment).toContain('actor.sourceLinks.length')
    expect(enrichment).toContain('actor.automationEvidence.length')
    expect(enrichment).not.toContain('>Confidence</')
    expect(enrichment).not.toContain('{actor.confidence}%')
})
