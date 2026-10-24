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
                id: 'run-2', target: '198.51.100.10', targetOrigin: 'https://example.com',
                findings: [{
                    findingId: 'finding-1', provider: 'tenable-vm' as const, pluginId: '12345', cveIds: [],
                    title: 'Example plugin finding', severity: 'high', cvssScore: 8.1, description: null,
                    solution: null, evidence: 'Plugin evidence', assetAddress: '8.8.8.8', firstSeen: null,
                    lastSeen: null, status: 'open', observed: true, port: 443, protocol: 'tcp',
                }],
            },
        }],
    }
    const html = renderToStaticMarkup(<UvmAssessmentReportView assessment={report} onClose={() => undefined} onOpenFindings={() => undefined} onOpenRun={() => undefined} />)
    expect(html).toContain('Review in triage')
    expect(html).toContain('View run details')
    expect(html).toContain('Target: https://example.com · Run: run-2')
})

test('assessment report keeps HTTP observations available in a collapsed disclosure', () => {
    const run = { ...data.runs[1], id: 'run-httpx', engine: 'httpx', target: 'example.com', findings: [], observations: [{
        id: 'observation-1', address: '198.51.100.10', url: 'https://example.com/', statusCode: 200,
        title: 'Example', contentType: 'text/html', contentLength: 512, webServer: 'openresty', technologies: ['Next.js'],
    }] }
    const report = {
        id: 'assessment-httpx', requestId: 'request-httpx', status: 'succeeded' as const, source: 'manual' as const,
        createdAt: new Date(0).toISOString(), startedAt: null, finishedAt: null,
        jobs: [{
            id: 'job-httpx', assetId: 'asset-1', asset: 'example.com', engine: 'httpx' as const,
            profile: 'httpx-root-probe-v1', stageIndex: 0, stage: 'assessment', runId: run.id, status: 'succeeded',
            error: null, attemptCount: 1, nextAttemptAt: null, createdAt: new Date(0).toISOString(),
            startedAt: null, finishedAt: null, run,
        }],
    }
    const html = renderToStaticMarkup(<UvmAssessmentReportView assessment={report} onClose={() => undefined} onOpenFindings={() => undefined} onOpenRun={() => undefined} />)
    expect(html).toContain('Engine observations · 1')
    expect(html).toContain('https://example.com/')
    expect(html).toContain('openresty')
    expect(html).not.toMatch(/<details[^>]*open[^>]*>/)
})
