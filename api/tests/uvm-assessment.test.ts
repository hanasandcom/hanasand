import { expect, test } from 'bun:test'

const { assessmentPlanMatches, validateUvmAssessmentInput } = await import('../src/utils/vulnerabilities/uvmScanner/assessments.ts')

const requestId = '123e4567-e89b-42d3-a456-426614174000'

test('assessment plans accept a bounded multi-asset and multi-engine selection', () => {
    expect(validateUvmAssessmentInput({
        requestId,
        assetIds: ['asset-b', 'asset-a'],
        engines: [{ engine: 'tenable-vm', scanId: '101' }, { engine: 'gvm' }, { engine: 'nmap' }],
        authorized: true,
    })).toEqual({
        requestId,
        assetIds: ['asset-a', 'asset-b'],
        engines: [{ engine: 'gvm' }, { engine: 'nmap' }, { engine: 'tenable-vm', scanId: '101' }],
        authorized: true,
    })
})

test('assessment plans reject duplicate or excessive targets and duplicate engines', () => {
    expect(validateUvmAssessmentInput({ requestId, assetIds: ['asset-a', 'asset-a'], engines: [{ engine: 'nmap' }], authorized: true })).toBeNull()
    expect(validateUvmAssessmentInput({ requestId, assetIds: Array.from({ length: 11 }, (_, index) => `asset-${index}`), engines: [{ engine: 'nmap' }], authorized: true })).toBeNull()
    expect(validateUvmAssessmentInput({ requestId, assetIds: ['asset-a'], engines: [{ engine: 'nmap' }, { engine: 'nmap' }], authorized: true })).toBeNull()
})

test('assessment plans reject unsupported engines, client-selected GVM profiles, and invalid Tenable IDs', () => {
    expect(validateUvmAssessmentInput({ requestId, assetIds: ['asset-a'], engines: [{ engine: 'nessus' }], authorized: true })).toBeNull()
    expect(validateUvmAssessmentInput({ requestId, assetIds: ['asset-a'], engines: [{ engine: 'gvm', profile: 'Full and Fast' }], authorized: true })).toBeNull()
    expect(validateUvmAssessmentInput({ requestId, assetIds: ['asset-a'], engines: [{ engine: 'tenable-vm', scanId: '../admin' }], authorized: true })).toBeNull()
    expect(validateUvmAssessmentInput({ requestId, assetIds: ['asset-a'], engines: [{ engine: 'nmap', targetUrl: 'http://127.0.0.1' }], authorized: true })).toBeNull()
})

test('assessment plans require an explicit authorization choice and a request UUID', () => {
    expect(validateUvmAssessmentInput({ requestId, assetIds: ['asset-a'], engines: [{ engine: 'nmap' }] })).toBeNull()
    expect(validateUvmAssessmentInput({ requestId: 'not-a-uuid', assetIds: ['asset-a'], engines: [{ engine: 'nmap' }], authorized: true })).toBeNull()
    expect(validateUvmAssessmentInput({ requestId, assetIds: ['asset-a'], engines: [{ engine: 'nmap' }], authorized: 'yes' })).toBeNull()
})

test('idempotency compares JSONB plans independent of object key order', () => {
    const expected = { assetIds: ['asset-a', 'asset-b'], engines: [{ engine: 'gvm' as const }, { engine: 'nmap' as const }] }
    expect(assessmentPlanMatches({ engines: [{ engine: 'nmap' }, { engine: 'gvm' }], assetIds: ['asset-b', 'asset-a'] }, expected)).toBe(true)
    expect(assessmentPlanMatches({ assetIds: ['asset-a'], engines: [{ engine: 'gvm' }, { engine: 'nmap' }] }, expected)).toBe(false)
})
