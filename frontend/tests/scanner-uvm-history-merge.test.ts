// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { data } from './scanner-uvm-panel.fixture'
import { mergeUvmDashboardRefresh } from '../src/app/dashboard/scanner/uvmPanelDashboardState'

test('dashboard refresh retains loaded older findings and advances refreshed findings to the top', () => {
    const olderFinding = { ...data.findings[1]!, id: 'finding-older', title: 'Older loaded finding' }
    const current = { ...data, findings: [...data.findings, olderFinding], findingsNextCursor: null }
    const updatedFirstPageFinding = { ...data.findings[0]!, title: 'Refreshed latest finding' }
    const refreshed = { ...data, findings: [updatedFirstPageFinding], findingsNextCursor: 'new-first-page-cursor' }

    const merged = mergeUvmDashboardRefresh(current, refreshed, true)

    expect(merged.findings.map(finding => finding.id)).toEqual([updatedFirstPageFinding.id, data.findings[1]!.id, olderFinding.id])
    expect(merged.findings[0]?.title).toBe('Refreshed latest finding')
    expect(merged.findingsNextCursor).toBeNull()
})

test('dashboard refresh uses its cursor until the user expands finding history', () => {
    const current = { ...data, findingsNextCursor: 'older-page-cursor' }
    const refreshed = { ...data, findingsNextCursor: 'refreshed-cursor' }

    expect(mergeUvmDashboardRefresh(current, refreshed).findingsNextCursor).toBe('refreshed-cursor')
    expect(mergeUvmDashboardRefresh(current, refreshed, true).findingsNextCursor).toBe('older-page-cursor')
})
