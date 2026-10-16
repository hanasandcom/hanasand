import { expect, test } from '@playwright/test'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

test('DWM case detail keeps case actions, evidence, and delivery in focused panels', async () => {
    const folder = path.join(root, 'src/app/dashboard/cases/[id]/case-detail')
    const files = await readdir(folder)
    const source = (await Promise.all([
        readFile(path.join(root, 'src/app/dashboard/cases/[id]/case-detail-client.tsx'), 'utf8'),
        ...files.filter(file => /\.tsx?$/.test(file)).map(file => readFile(path.join(folder, file), 'utf8')),
    ])).join('\n')

    expect(source).toContain('id=\'dwm-case-actions\'')
    expect(source).toContain('Analyst actions')
    expect(source).toContain('data-dwm-case-action-blockers=\'true\'')
    expect(source).toContain('notifyCustomer')
    expect(source).toContain('data-dwm-case-evidence-mobile-list=\'true\'')
    expect(source).toContain('data-dwm-case-evidence-mobile-row=\'true\'')
    expect(source).toContain('data-dwm-case-evidence-desktop-table=\'true\'')
    expect(source).toContain('DWM_CASE_EVIDENCE_PREVIEW_ROWS')
    expect(source).toContain('DWM_CASE_REPORT_MAX_EVIDENCE')
    expect(source).toContain('Select all')
    expect(source).toContain('Case and evidence report')
    expect(source).toContain('Export JSON report')
    expect(source).toContain('Export STIX 2.1')
    expect(source).toContain('Test STIX report')
    expect(source).toContain('Retry exact report')
    expect(source).toContain('Hanasand receiver receipt')
    expect(source).toContain('Webhook delivery needs a linked alert before it can be tested or sent.')
    expect(source).toContain('setSelectedEvidenceIds(previous => previous.filter(id => availableIds.includes(id)))')
    expect(source).toContain('reportCaseId: caseId')
    expect(source).toContain('deliveryId: retryDeliveryId')
    expect(source).not.toContain('limit: 1')
    expect(source).not.toContain('What returned')
})
