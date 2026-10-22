import run from '#db'
import { HANASAND_ORGANIZATION_ID } from '#utils/auth/organizationPagePolicy.ts'
import {
    getGvmEngineStatus, getGvmRuns, getNetworkScannerEngines, getNetworkScannerRuns, getTenableIntegration, getTenableRuns, getTenableScans,
} from '../scanner.ts'
import { listUvmAssets } from './assets.ts'
import { listUvmAssessments } from './assessments.ts'
import { ensureUvmSchema } from './shared.ts'

export async function getUvmDashboard() {
    await ensureUvmSchema()
    const [assets, localRuns, engines, scannerRuns, tenableIntegration, tenableRunResponse, assessments, gvmStatus, gvmRunResponse] = await Promise.all([
        listUvmAssets(),
        run(`SELECT r.id, r.asset_id, r.request_id, r.scanner_run_id, r.engine, r.profile, r.source, r.status,
                r.actor_id, r.error, r.created_at, r.started_at, r.finished_at, a.hostname
            FROM uvm_network_runs r JOIN uvm_assets a ON a.id = r.asset_id
            WHERE r.organization_id = $1 ORDER BY r.created_at DESC LIMIT 50`, [HANASAND_ORGANIZATION_ID]),
        getNetworkScannerEngines().catch(() => ({ engines: [], error: 'Scanner service is unavailable.' })),
        getNetworkScannerRuns(HANASAND_ORGANIZATION_ID, 50).catch(() => ({ runs: [], error: 'Scanner service is unavailable.' })),
        getTenableIntegration(HANASAND_ORGANIZATION_ID).catch(() => null),
        getTenableRuns(HANASAND_ORGANIZATION_ID, 50).catch(() => ({ runs: [], error: 'Scanner service is unavailable.' })),
        listUvmAssessments(25),
        getGvmEngineStatus().catch(() => ({ id: 'gvm' as const, name: 'Greenbone Vulnerability Management', provider: 'gvm' as const, available: false, configured: false, ready: false, profile: 'Full and Fast', error: 'Scanner service is unavailable.' })),
        getGvmRuns(HANASAND_ORGANIZATION_ID, 50).catch(() => ({ runs: [], error: 'Scanner service is unavailable.' })),
    ])
    const serviceRuns = new Map(scannerRuns.runs.map(item => [item.runId, item]))
    const requestRuns = new Map(scannerRuns.runs.map(item => [item.requestId, item]))
    const scannerUnavailable = 'error' in scannerRuns
    const runs = localRuns.rows.map(row => {
        const remote = (row.scanner_run_id ? serviceRuns.get(row.scanner_run_id) : undefined) || requestRuns.get(row.request_id)
        return {
            id: row.id, scannerRunId: row.scanner_run_id, requestId: row.request_id, assetId: row.asset_id,
            target: row.hostname, engine: row.engine, profile: row.profile, source: row.source,
            status: remote?.status || (scannerUnavailable && row.scanner_run_id ? 'unknown' : row.status),
            createdAt: row.created_at, startedAt: remote?.startedAt || row.started_at, finishedAt: remote?.finishedAt || row.finished_at,
            error: remote?.error || row.error || (scannerUnavailable && row.scanner_run_id ? 'Scanner service is unavailable; the run state could not be refreshed.' : null),
            hosts: remote?.hosts || [], engineVersion: remote?.engineVersion || null, rawXmlSha256: remote?.rawXmlSha256 || null,
            coverage: remote ? {
                known: remote.coverage.known,
                requestedAddresses: remote.coverage.requestedAddresses,
                attemptedAddresses: remote.coverage.attemptedAddresses,
                completedAddresses: remote.coverage.completedAddresses,
                completedAddressList: remote.coverage.completedAddressList,
                missingAddresses: remote.coverage.missingAddresses,
                unattemptedAddresses: remote.coverage.unattemptedAddresses,
                openPorts: remote.hosts.reduce((count, host) => count + host.ports.filter(port => port.state === 'open').length, 0),
            } : null,
        }
    })
    const tenableServiceRuns = new Map(tenableRunResponse.runs.map(item => [item.runId, item]))
    const tenableRequestRuns = new Map(tenableRunResponse.runs.map(item => [item.requestId, item]))
    const tenableUnavailable = 'error' in tenableRunResponse
    const tenableLocalRuns = await run(`SELECT r.id, r.asset_id, r.request_id, r.scanner_run_id, r.scan_id, r.source, r.status,
            r.error, r.created_at, r.started_at, r.finished_at, a.hostname
        FROM uvm_tenable_runs r JOIN uvm_assets a ON a.id = r.asset_id
        WHERE r.organization_id = $1 ORDER BY r.created_at DESC LIMIT 50`, [HANASAND_ORGANIZATION_ID])
    const tenableRuns = tenableLocalRuns.rows.map(row => {
        const remote = (row.scanner_run_id ? tenableServiceRuns.get(row.scanner_run_id) : undefined) || tenableRequestRuns.get(row.request_id)
        return {
            id: row.id, scannerRunId: row.scanner_run_id, requestId: row.request_id, assetId: row.asset_id,
            target: row.hostname, engine: 'tenable-vm', profile: remote?.scanId || row.scan_id, source: row.source,
            status: remote?.status || (tenableUnavailable && row.scanner_run_id ? 'unknown' : row.status),
            createdAt: row.created_at, startedAt: remote?.startedAt || row.started_at, finishedAt: remote?.finishedAt || row.finished_at,
            error: remote?.error || row.error || (tenableUnavailable && row.scanner_run_id ? 'Scanner service is unavailable; the run state could not be refreshed.' : null),
            engineVersion: null, rawXmlSha256: null, hosts: [], findings: remote?.findings || [], coverage: remote?.coverage || null,
        }
    })
    const gvmRuns = gvmRunResponse.runs.map(item => ({
        id: item.runId, scannerRunId: item.runId, requestId: item.requestId, assetId: item.assetId, target: item.target,
        engine: 'gvm', profile: 'Full and Fast', source: 'manual' as const, status: item.status,
        createdAt: item.createdAt, startedAt: item.startedAt, finishedAt: item.finishedAt, error: item.error,
        hosts: [], findings: [], engineVersion: null, rawXmlSha256: item.rawReportSha256,
        coverage: item.coverage ? { attemptedAddresses: item.coverage.attemptedAddresses, completedAddresses: item.coverage.completedAddresses } : null,
    }))
    const findingRows = await run(`SELECT id, asset_id, asset_label, asset_address, engine, external_id, title, severity, cvss_score, cve_ids,
            description, solution, evidence, status, triage_note, first_seen, last_seen, updated_at
        FROM uvm_findings WHERE organization_id = $1 ORDER BY
            CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END,
            last_seen DESC NULLS LAST LIMIT 200`, [HANASAND_ORGANIZATION_ID])
    let tenableScans: Awaited<ReturnType<typeof getTenableScans>>['scans'] = []
    let tenableError: string | null = tenableUnavailable ? tenableRunResponse.error : null
    if (tenableIntegration?.configured) {
        try { tenableScans = (await getTenableScans(HANASAND_ORGANIZATION_ID)).scans }
        catch { tenableError = 'Tenable scan templates could not be loaded from Scanner service.' }
    }
    return {
        assets,
        engines: [...engines.engines.filter(engine => engine.id === 'nmap'), {
            id: 'gvm', name: gvmStatus.name, status: gvmStatus.available ? 'available' as const : 'unavailable' as const, version: null, reason: gvmStatus.error,
            profiles: [{ id: 'full-and-fast', name: gvmStatus.profile, safe: true }],
            coverage: ['Greenbone Full and Fast vulnerability assessment', 'Authorized public IPv4 addresses', 'Loaded vulnerability feeds'],
            notCovered: ['Coverage depends on the configured Greenbone port list and current feeds', 'No authentication or credentialed checks are configured by Hanasand'],
        }, ...(tenableIntegration?.configured ? [{
            id: 'tenable-vm', name: 'Tenable Vulnerability Management', status: 'available', version: null, reason: null,
            profiles: tenableScans.map(scan => ({ id: scan.id, name: scan.name, safe: true })),
            coverage: ['Configured Tenable scan template', 'Authorized public IPv4 addresses'],
            notCovered: ['Authentication and plugin coverage depend on the selected Tenable scan configuration'],
        }] : [])],
        runs: [...runs, ...tenableRuns, ...gvmRuns].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 50),
        assessments,
        scannerError: ('error' in engines ? engines.error : null) || ('error' in scannerRuns ? scannerRuns.error : null) || tenableError,
        tenableIntegration, tenableScans,
        findings: findingRows.rows.map(row => ({
            id: row.id, assetId: row.asset_id, asset: row.asset_label, address: row.asset_address, engine: row.engine,
            externalId: row.external_id, title: row.title, severity: row.severity, cvssScore: row.cvss_score,
            cveIds: row.cve_ids, description: row.description, solution: row.solution, evidence: row.evidence,
            status: row.status, triageNote: row.triage_note, firstSeen: row.first_seen, lastSeen: row.last_seen, updatedAt: row.updated_at,
        })),
    }
}
