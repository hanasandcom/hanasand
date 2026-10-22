// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import type { UvmDashboard } from '../src/utils/monitoring/types'
import UvmPanel from '../src/app/dashboard/scanner/uvmPanel'

const data: UvmDashboard = {
    assets: [{
        id: 'asset-1', hostname: 'example.com', verificationStatus: 'verified',
        verificationRecordName: '_hanasand-security-verification.example.com',
        verificationRecordValue: 'hanasand-security-verification=challenge', verificationMethod: 'dns_txt',
        verifiedAt: new Date(0).toISOString(), scanAuthorizedAt: new Date(0).toISOString(),
        authorizedAddresses: ['8.8.8.8'], scheduleEnabled: false, scheduleEngine: 'nmap', scheduleScanId: null, intervalMinutes: 60,
        nextRunAt: null, createdAt: new Date(0).toISOString(),
    }],
    engines: [{ id: 'nmap', name: 'Nmap', status: 'available', version: '7.98', reason: null,
        profiles: [{ id: 'tcp-top-100', name: 'TCP ports and service versions', safe: true }],
        coverage: ['Top 100 TCP ports', 'Light service version detection'],
        notCovered: ['UDP', 'Vulnerability scripts'],
    }, { id: 'tenable-vm', name: 'Tenable Vulnerability Management', status: 'available', version: null, reason: null,
        profiles: [{ id: 'scan-1', name: 'External perimeter', safe: true }], coverage: ['Tenable scan configuration'], notCovered: ['Autonomous exploitation'],
    }],
    runs: [{
        id: 'run-1', scannerRunId: 'remote-1', requestId: 'request-1', assetId: 'asset-1', target: 'example.com',
        engine: 'nmap', profile: 'tcp-top-100', source: 'manual', status: 'succeeded',
        createdAt: new Date(0).toISOString(), startedAt: new Date(0).toISOString(), finishedAt: new Date(0).toISOString(),
        error: null, hosts: [{ address: '8.8.8.8', status: 'up', ports: [{ port: 443, protocol: 'tcp', state: 'open', service: 'https', product: 'Example', version: '1.0', extraInfo: null }] }],
        engineVersion: '7.98', rawXmlSha256: 'abc123', coverage: { attemptedAddresses: 1, completedAddresses: 1, openPorts: 1 },
    }, {
        id: 'run-2', scannerRunId: 'remote-2', requestId: 'request-2', assetId: 'asset-1', target: 'example.com',
        engine: 'tenable-vm', profile: 'scan-1', source: 'manual', status: 'succeeded', createdAt: new Date(0).toISOString(),
        startedAt: new Date(0).toISOString(), finishedAt: new Date(0).toISOString(), error: null, hosts: [], findings: [],
        engineVersion: null, rawXmlSha256: null, coverage: { attemptedAddresses: 1, completedAddresses: 1 },
    }, {
        id: 'run-3', scannerRunId: 'remote-3', requestId: 'request-3', assetId: 'asset-1', target: 'example.com',
        engine: 'nmap', profile: 'tcp-top-100', source: 'manual', status: 'running', createdAt: new Date(0).toISOString(),
        startedAt: new Date(0).toISOString(), finishedAt: null, error: null, hosts: [], engineVersion: '7.98', rawXmlSha256: null,
        coverage: { attemptedAddresses: 1, completedAddresses: 0 },
    }],
    scannerError: null,
    tenableIntegration: { provider: 'tenable-vm', configured: true, credentialStoreAvailable: true, region: 'eu', accessKeyHint: '••••1234', testedAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString(), error: null },
    tenableScans: [{ id: 'scan-1', scheduleUuid: null, name: 'External perimeter', enabled: true, status: 'ready', scannerName: 'cloud', targets: 'example.com' }],
    findings: [
        { id: 'finding-1', assetId: 'asset-1', asset: 'example.com', address: '8.8.8.8', engine: 'tenable-vm', externalId: '12345:8.8.8.8', title: 'Example plugin finding', severity: 'high', cvssScore: 8.1, cveIds: ['CVE-2025-0001'], description: 'Affected version detected.', solution: 'Update the package.', evidence: 'Plugin output', status: 'open', triageNote: null, firstSeen: new Date(0).toISOString(), lastSeen: new Date(0).toISOString(), updatedAt: new Date(0).toISOString() },
        { id: 'finding-2', assetId: 'asset-1', asset: 'example.com', address: null, engine: 'hanasand-web', externalId: 'https://example.com:header.csp', title: 'Content-Security-Policy is present', severity: 'medium', cvssScore: null, cveIds: [], description: 'The response did not include a Content-Security-Policy header.', solution: null, evidence: '{"value":null}', status: 'open', triageNote: null, firstSeen: new Date(0).toISOString(), lastSeen: new Date(0).toISOString(), updatedAt: new Date(0).toISOString() },
    ],
}

const noop = async() => ({}) as never

test('overview shows asset coverage, current scan state, and clear next actions', () => {
    const html = renderToStaticMarkup(<UvmPanel initialData={data}
        refreshAction={async() => data}
        createAssetAction={noop}
        verifyAssetAction={noop}
        runScanAction={noop}
        scheduleAction={noop}
        configureTenableAction={noop}
        disconnectTenableAction={noop}
        runTenableScanAction={noop}
        updateFindingAction={noop}
        cancelRunAction={noop}
    />)

    expect(html).toContain('example.com')
    expect(html).toContain('Verified assets')
    expect(html).toContain('1 / 1')
    expect(html).toContain('Scans in progress')
    expect(html).toContain('Findings needing attention')
    expect(html).toContain('Coverage state')
    expect(html).toContain('An unscanned asset, partial run, or unavailable engine does not count as a clean result.')
    expect(html).toContain('Address coverage 1/1')
    expect(html).toContain('Review scan history')
    expect(html).toContain('Manage assets')
    expect(html).toContain('Triage findings')
    expect(html).toContain('Findings')
    expect(html).toContain('Recent scanner runs')
    expect(html).not.toContain('Cancel scan')
})
