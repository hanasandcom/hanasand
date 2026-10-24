// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { data } from './scanner-uvm-panel.fixture'
import { filterAndSortUvmFindings } from '../src/app/dashboard/scanner/uvmFindingFilters'

test('actionable findings exclude informational checks but keep them searchable by severity', () => {
    const informational = { ...data.findings[1]!, id: 'finding-info', severity: 'info' }
    const high = { ...data.findings[0]!, id: 'finding-high', severity: 'high' }
    const findings = [informational, high]

    expect(filterAndSortUvmFindings(findings, { query: '', engine: 'all', severity: 'all', status: 'actionable', asset: 'all' }).map(finding => finding.id)).toEqual(['finding-high'])
    expect(filterAndSortUvmFindings(findings, { query: '', engine: 'all', severity: 'info', status: 'all', asset: 'all' }).map(finding => finding.id)).toEqual(['finding-info'])
})
