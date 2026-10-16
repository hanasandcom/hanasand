import { computeOutboundThirdPartyReportChecksum } from '../../src/utils/dwm/thirdPartyReport.ts'

export function reportFixture(format: 'stix' | 'json' = 'stix') {
    if (format === 'json') {
        return withReportChecksum({
            schemaVersion: 'analyst.case_export.v1',
            evidence: [{ id: 'evidence_1' }],
            reportPolicy: {
                direction: 'outbound_third_party',
                format: 'hanasand-json',
                caseId: 'case_1',
                alertId: 'alert_1',
                organizationId: 'org_1',
                evidenceIds: ['evidence_1'],
                evidenceCount: 1,
            },
        })
    }
    return withReportChecksum({
        bundle: {
            type: 'bundle',
            id: 'bundle--11111111-1111-4111-8111-111111111111',
            objects: [
                { type: 'identity', spec_version: '2.1', id: 'identity--11111111-1111-4111-8111-111111111111' },
                { type: 'x-ti-evidence', spec_version: '2.1', id: 'x-ti-evidence--11111111-1111-4111-8111-111111111111', x_ti_capture_id: 'capture_1', x_ti_source_id: 'source_1', x_ti_content_hash: 'hash_1' },
                { type: 'report', spec_version: '2.1', id: 'report--11111111-1111-4111-8111-111111111111', published: '2026-07-23T10:00:00.000Z', object_refs: ['x-ti-evidence--11111111-1111-4111-8111-111111111111'] },
            ],
        },
        reportPolicy: {
            direction: 'outbound_third_party',
            format: 'stix-2.1',
            caseId: 'case_1',
            alertId: 'alert_1',
            organizationId: 'org_1',
            evidenceIds: ['evidence_1'],
            evidenceCount: 1,
        },
        standardsValidation: { standard: 'STIX 2.1', valid: true, issues: [] },
    })
}

export function withReportChecksum<T extends Record<string, any>>(value: T) {
    const report = { ...value }
    delete report.exportChecksum
    const reportPolicy = { ...report.reportPolicy }
    delete reportPolicy.exportChecksum
    const draft = { ...report, reportPolicy }
    const exportChecksum = computeOutboundThirdPartyReportChecksum(draft)
    return { ...draft, exportChecksum, reportPolicy: { ...reportPolicy, exportChecksum } }
}

export function restoreEnv(name: string, value: string | undefined) {
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
}
