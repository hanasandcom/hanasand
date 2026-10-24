// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { data } from './scanner-uvm-panel.fixture'
import { UvmAssessmentReportView } from '../src/app/dashboard/scanner/uvmPanelAssessmentReport'
import { buildAssessmentFindingFilters } from '../src/app/dashboard/scanner/uvmPanelHelpers'

test('assessment triage opens findings scoped to the report stage', () => {
    expect(buildAssessmentFindingFilters('asset-1', 'tenable-vm')).toEqual({
        query: '', engine: 'tenable-vm', severity: 'all', status: 'all', asset: 'asset-1',
    })
})

test('assessment report exposes a triage action for stages with findings', () => {
    const report = {
        id: 'assessment-1', requestId: 'request-1', status: 'partial' as const, source: 'manual' as const,
        createdAt: new Date(0).toISOString(), startedAt: null, finishedAt: null,
        jobs: [{
            id: 'job-1', assetId: 'asset-1', asset: 'example.com', engine: 'tenable-vm' as const,
            profile: 'scan-1', stageIndex: 0, stage: 'assessment', runId: 'run-2', status: 'succeeded',
            error: null, attemptCount: 1, nextAttemptAt: null, createdAt: new Date(0).toISOString(),
            startedAt: null, finishedAt: null,
            run: {
                ...data.runs[1],
                findings: [{
                    findingId: 'finding-1', provider: 'tenable-vm' as const, pluginId: '12345', cveIds: [],
                    title: 'Example plugin finding', severity: 'high', cvssScore: 8.1, description: null,
                    solution: null, evidence: 'Plugin evidence', assetAddress: '8.8.8.8', firstSeen: null,
                    lastSeen: null, status: 'open', observed: true, port: 443, protocol: 'tcp',
                }],
            },
        }],
    }
    const html = renderToStaticMarkup(<UvmAssessmentReportView assessment={report} onClose={() => undefined} onOpenFindings={() => undefined} />)
    expect(html).toContain('Review in triage')
})
