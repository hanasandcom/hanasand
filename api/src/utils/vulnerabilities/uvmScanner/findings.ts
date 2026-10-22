import { createHash, randomUUID } from 'node:crypto'
import run from '#db'
import { HANASAND_ORGANIZATION_ID } from '#utils/auth/organizationPagePolicy.ts'
import type { WebScanRun } from '../webScanner.ts'
import { normalizeUvmHostname } from '../uvmScope.ts'
import type { GvmRun, TenableRun } from '../scanner.ts'
import { getGvmRun, getNetworkScannerRun, getTenableRun } from '../scanner.ts'
import { ensureUvmSchema, errorMessage, type UvmTriageStatus } from './shared.ts'
import { reconcileUvmAssessments } from './assessments.ts'

export async function reconcileUvmRuns() {
    await ensureUvmSchema()
    const networkRuns = await run(`SELECT id, scanner_run_id FROM uvm_network_runs
        WHERE organization_id = $1 AND scanner_run_id IS NOT NULL
          AND status IN ('queued', 'launching', 'running', 'exporting') ORDER BY created_at LIMIT 100`, [HANASAND_ORGANIZATION_ID])
    const tenableRuns = await run(`SELECT id, scanner_run_id FROM uvm_tenable_runs
        WHERE organization_id = $1 AND scanner_run_id IS NOT NULL
          AND (status IN ('queued', 'running') OR (status IN ('succeeded', 'partial') AND NOT EXISTS (
            SELECT 1 FROM uvm_finding_sync_runs s WHERE s.organization_id = uvm_tenable_runs.organization_id
              AND s.run_id = uvm_tenable_runs.scanner_run_id
          ))) ORDER BY created_at LIMIT 500`, [HANASAND_ORGANIZATION_ID])
    let reconciled = 0
    let failures = 0
    for (const row of networkRuns.rows) {
        try {
            const remote = await getNetworkScannerRun(row.scanner_run_id, HANASAND_ORGANIZATION_ID)
            await run(`UPDATE uvm_network_runs SET status = $2, error = $3, started_at = COALESCE(started_at, $4),
                    finished_at = CASE WHEN $5 THEN COALESCE(finished_at, $6) ELSE finished_at END
                WHERE id = $1 AND organization_id = $7`,
            [row.id, persistedRunStatus(remote.status), remote.error, remote.startedAt, ['succeeded', 'partial', 'failed', 'cancelled'].includes(remote.status), remote.finishedAt, HANASAND_ORGANIZATION_ID])
            reconciled += 1
        } catch (error) {
            failures += 1
            console.error('UVM network run reconciliation failed', { runId: row.id, error: errorMessage(error) })
        }
    }
    for (const row of tenableRuns.rows) {
        try {
            const remote = await getTenableRun(row.scanner_run_id, HANASAND_ORGANIZATION_ID)
            await run(`UPDATE uvm_tenable_runs SET status = $2, error = $3, started_at = COALESCE(started_at, $4),
                    finished_at = CASE WHEN $5 THEN COALESCE(finished_at, $6) ELSE finished_at END
                WHERE id = $1 AND organization_id = $7`,
            [row.id, persistedRunStatus(remote.status), remote.error, remote.startedAt, ['succeeded', 'partial', 'failed', 'cancelled'].includes(remote.status), remote.finishedAt, HANASAND_ORGANIZATION_ID])
            if (['succeeded', 'partial'].includes(remote.status)) await importTenableFindings(remote)
            reconciled += 1
        } catch (error) {
            failures += 1
            console.error('UVM Tenable run reconciliation failed', { runId: row.id, error: errorMessage(error) })
        }
    }
    await reconcileUvmAssessments()
    const gvmSteps = await run(`SELECT s.id, s.run_id FROM uvm_assessment_steps s
        JOIN uvm_assessments a ON a.id = s.assessment_id
        WHERE s.organization_id = $1 AND s.engine = 'gvm' AND s.run_id IS NOT NULL
          AND (s.status IN ('queued', 'running') OR (s.status IN ('succeeded', 'partial') AND NOT EXISTS (
            SELECT 1 FROM uvm_finding_sync_runs sync WHERE sync.organization_id = s.organization_id AND sync.run_id = s.run_id
          ))) ORDER BY s.created_at LIMIT 100`, [HANASAND_ORGANIZATION_ID])
    for (const step of gvmSteps.rows) {
        try {
            const remote = await getGvmRun(step.run_id, HANASAND_ORGANIZATION_ID)
            const finished = ['succeeded', 'partial', 'failed', 'cancelled'].includes(remote.status)
            await run(`UPDATE uvm_assessment_steps SET status = $2, error = $3, started_at = COALESCE(started_at, $4),
                    finished_at = CASE WHEN $5 THEN COALESCE(finished_at, $6, NOW()) ELSE finished_at END
                WHERE id = $1 AND organization_id = $7`,
            [step.id, persistedRunStatus(remote.status), remote.error, remote.startedAt, finished, remote.finishedAt, HANASAND_ORGANIZATION_ID])
            if (['succeeded', 'partial'].includes(remote.status)) await importGvmFindings(remote)
            reconciled += 1
        } catch (error) {
            failures += 1
            console.error('UVM GVM run reconciliation failed', { assessmentStepId: step.id, error: errorMessage(error) })
        }
    }
    await reconcileUvmAssessments()
    try {
        const { getWebScanReport } = await import('../webScanner.ts')
        const report = await getWebScanReport()
        const webScans = [...report.history, ...(report.current ? [report.current] : [])]
            .filter(scan => scan.status === 'completed' && !scan.error)
        const alreadyImported = webScans.length ? await run(`SELECT run_id FROM uvm_finding_sync_runs
            WHERE organization_id = $1 AND run_id = ANY($2::text[])`, [HANASAND_ORGANIZATION_ID, webScans.map(scan => scan.scanId)]) : { rows: [] }
        const importedIds = new Set(alreadyImported.rows.map(row => row.run_id))
        for (const scan of webScans) if (!importedIds.has(scan.scanId)) await importWebScanFindings(scan, true)
    } catch (error) {
        failures += 1
        console.error('UVM web scan findings reconciliation failed', { error: errorMessage(error) })
    }
    if (failures) throw new Error(`UVM run reconciliation completed with ${failures} failed item(s); ${reconciled} scanner run(s) were reconciled.`)
    return { reconciled }
}

function persistedRunStatus(status: string) {
    return ['launching', 'exporting', 'cancelling'].includes(status) ? 'running' : status
}

export async function updateUvmFinding(input: { findingId: string, status: UvmTriageStatus, note: string }) {
    await ensureUvmSchema()
    const result = await run(`UPDATE uvm_findings SET status = $3, triage_note = NULLIF($4, ''), updated_at = NOW()
        WHERE id = $1 AND organization_id = $2 RETURNING id, status, triage_note, updated_at`,
    [input.findingId, HANASAND_ORGANIZATION_ID, input.status, input.note.trim()])
    return result.rows[0] || null
}

export async function importTenableFindings(scan: TenableRun) {
    if (!['succeeded', 'partial'].includes(scan.status)) return
    const alreadyImported = await run('SELECT 1 FROM uvm_finding_sync_runs WHERE organization_id = $1 AND run_id = $2', [HANASAND_ORGANIZATION_ID, scan.runId])
    if (alreadyImported.rows.length) return
    for (const finding of scan.findings) {
        const fingerprint = createHash('sha256').update(`tenable-vm:${scan.assetId}:${finding.findingId}`).digest('hex')
        const findingId = randomUUID()
        const saved = await run(`INSERT INTO uvm_findings (id, organization_id, asset_id, asset_label, asset_address, engine, last_scan_profile, external_id, fingerprint,
                title, severity, cvss_score, cve_ids, description, solution, evidence, first_seen, last_seen, last_observed_run_id)
            VALUES ($1, $2, $3, $4, $5, 'tenable-vm', $6, $7, $8, $9, $10, $11, $12::jsonb, $13, $14, $15, $16, $17, $18)
            ON CONFLICT (organization_id, fingerprint) DO UPDATE SET
                asset_address = EXCLUDED.asset_address, last_scan_profile = EXCLUDED.last_scan_profile,
                title = EXCLUDED.title, severity = EXCLUDED.severity, cvss_score = EXCLUDED.cvss_score,
                cve_ids = EXCLUDED.cve_ids, description = EXCLUDED.description, solution = EXCLUDED.solution,
                evidence = EXCLUDED.evidence, first_seen = COALESCE(LEAST(uvm_findings.first_seen, EXCLUDED.first_seen), uvm_findings.first_seen, EXCLUDED.first_seen),
                last_seen = GREATEST(COALESCE(uvm_findings.last_seen, EXCLUDED.last_seen), EXCLUDED.last_seen),
                last_observed_run_id = EXCLUDED.last_observed_run_id,
                status = CASE WHEN uvm_findings.status IN ('resolved', 'pending_verification') THEN 'open' ELSE uvm_findings.status END,
                triage_note = CASE WHEN uvm_findings.status IN ('resolved', 'pending_verification') THEN NULL ELSE uvm_findings.triage_note END,
                updated_at = NOW()
            WHERE uvm_findings.last_observed_run_id IS DISTINCT FROM EXCLUDED.last_observed_run_id
            RETURNING id`,
        [findingId, HANASAND_ORGANIZATION_ID, scan.assetId, scan.target, finding.assetAddress, scan.scanId, finding.findingId, fingerprint,
            finding.title, normalizeFindingSeverity(finding.severity), finding.cvssScore, JSON.stringify(finding.cveIds), finding.description,
            finding.solution, finding.evidence, finding.firstSeen, finding.lastSeen, scan.runId])
        const persistedId = saved.rows[0]?.id || (await run('SELECT id FROM uvm_findings WHERE organization_id = $1 AND fingerprint = $2', [HANASAND_ORGANIZATION_ID, fingerprint])).rows[0]?.id
        if (!persistedId) throw new Error('Tenable finding upsert did not return a saved finding.')
        await run(`INSERT INTO uvm_finding_observations (id, finding_id, organization_id, run_id, evidence, observed_at)
            VALUES ($1, $2, $3, $4, $5, COALESCE($6::timestamptz, NOW())) ON CONFLICT (finding_id, run_id) DO UPDATE SET evidence = EXCLUDED.evidence`,
        [randomUUID(), persistedId, HANASAND_ORGANIZATION_ID, scan.runId, finding.evidence, finding.lastSeen])
    }
    const complete = scan.status === 'succeeded' && scan.coverage
        && scan.coverage.attemptedAddresses === scan.coverage.completedAddresses
        && scan.coverage.attemptedAddresses === scan.addresses.length
    if (complete && scan.coverage && scan.coverage.attemptedAddresses > 0) {
        const currentRunIds = scan.findings.map(finding => finding.findingId)
        await run(`UPDATE uvm_findings SET status = 'resolved', last_observed_run_id = $3, updated_at = NOW()
            WHERE organization_id = $1 AND asset_id = $2 AND engine = 'tenable-vm'
              AND last_scan_profile = $5 AND asset_address = ANY($6::text[])
              AND status IN ('open', 'in_progress', 'pending_verification')
              AND NOT (external_id = ANY($4::text[])) AND last_observed_run_id IS DISTINCT FROM $3`,
        [HANASAND_ORGANIZATION_ID, scan.assetId, scan.runId, currentRunIds, scan.scanId, scan.addresses])
    }
    await run('INSERT INTO uvm_finding_sync_runs (organization_id, run_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [HANASAND_ORGANIZATION_ID, scan.runId])
}

export async function importGvmFindings(scan: GvmRun) {
    if (!['succeeded', 'partial'].includes(scan.status)) return
    const alreadyImported = await run('SELECT 1 FROM uvm_finding_sync_runs WHERE organization_id = $1 AND run_id = $2', [HANASAND_ORGANIZATION_ID, scan.runId])
    if (alreadyImported.rows.length) return
    for (const finding of scan.findings) {
        const fingerprint = createHash('sha256').update(`gvm:${scan.assetId}:${finding.findingId}`).digest('hex')
        const findingId = randomUUID()
        const saved = await run(`INSERT INTO uvm_findings (id, organization_id, asset_id, asset_label, asset_address, engine, last_scan_profile, external_id, fingerprint,
                title, severity, cvss_score, cve_ids, description, solution, evidence, last_seen, last_observed_run_id)
            VALUES ($1, $2, $3, $4, $5, 'gvm', 'Full and Fast', $6, $7, $8, $9, $10, $11::jsonb, $12, $13, $14, NOW(), $15)
            ON CONFLICT (organization_id, fingerprint) DO UPDATE SET
                asset_address = EXCLUDED.asset_address, last_scan_profile = EXCLUDED.last_scan_profile,
                title = EXCLUDED.title, severity = EXCLUDED.severity, cvss_score = EXCLUDED.cvss_score,
                cve_ids = EXCLUDED.cve_ids, description = EXCLUDED.description, solution = EXCLUDED.solution,
                evidence = EXCLUDED.evidence, last_seen = NOW(), last_observed_run_id = EXCLUDED.last_observed_run_id,
                status = CASE WHEN uvm_findings.status IN ('resolved', 'pending_verification') THEN 'open' ELSE uvm_findings.status END,
                triage_note = CASE WHEN uvm_findings.status IN ('resolved', 'pending_verification') THEN NULL ELSE uvm_findings.triage_note END,
                updated_at = NOW()
            WHERE uvm_findings.last_observed_run_id IS DISTINCT FROM EXCLUDED.last_observed_run_id
            RETURNING id`,
        [findingId, HANASAND_ORGANIZATION_ID, scan.assetId, scan.target, finding.assetAddress, finding.findingId, fingerprint,
            finding.title, normalizeFindingSeverity(finding.severity), finding.cvssScore, JSON.stringify(finding.cveIds), finding.description,
            finding.solution, finding.evidence, scan.runId])
        const persistedId = saved.rows[0]?.id || (await run('SELECT id FROM uvm_findings WHERE organization_id = $1 AND fingerprint = $2', [HANASAND_ORGANIZATION_ID, fingerprint])).rows[0]?.id
        if (!persistedId) throw new Error('GVM finding upsert did not return a saved finding.')
        await run(`INSERT INTO uvm_finding_observations (id, finding_id, organization_id, run_id, evidence)
            VALUES ($1, $2, $3, $4, $5) ON CONFLICT (finding_id, run_id) DO UPDATE SET evidence = EXCLUDED.evidence`,
        [randomUUID(), persistedId, HANASAND_ORGANIZATION_ID, scan.runId, finding.evidence])
    }
    const complete = scan.status === 'succeeded' && scan.coverage
        && scan.coverage.attemptedAddresses === scan.coverage.completedAddresses
        && scan.coverage.attemptedAddresses === scan.addresses.length
    if (complete && scan.coverage && scan.coverage.attemptedAddresses > 0) {
        const currentRunIds = scan.findings.map(finding => finding.findingId)
        await run(`UPDATE uvm_findings SET status = 'resolved', last_observed_run_id = $3, updated_at = NOW()
            WHERE organization_id = $1 AND asset_id = $2 AND engine = 'gvm'
              AND asset_address = ANY($5::text[]) AND status IN ('open', 'in_progress', 'pending_verification')
              AND NOT (external_id = ANY($4::text[])) AND last_observed_run_id IS DISTINCT FROM $3`,
        [HANASAND_ORGANIZATION_ID, scan.assetId, scan.runId, currentRunIds, scan.addresses])
    }
    await run('INSERT INTO uvm_finding_sync_runs (organization_id, run_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [HANASAND_ORGANIZATION_ID, scan.runId])
}

export async function importWebScanFindings(scan: WebScanRun, alreadyChecked = false) {
    if (scan.status !== 'completed' || scan.error) return
    if (!alreadyChecked) {
        const alreadyImported = await run('SELECT 1 FROM uvm_finding_sync_runs WHERE organization_id = $1 AND run_id = $2', [HANASAND_ORGANIZATION_ID, scan.scanId])
        if (alreadyImported.rows.length) return
    }
    for (const target of scan.targets) {
        let hostname: string
        try { hostname = normalizeUvmHostname(new URL(target.target).hostname) }
        catch { continue }
        const assetResult = await run('SELECT id FROM uvm_assets WHERE organization_id = $1 AND hostname = $2 AND verification_status <> \'disabled\'', [HANASAND_ORGANIZATION_ID, hostname])
        const assetId = assetResult.rows[0]?.id || null
        for (const check of target.checks) await importWebCheck({ scan, target, check, hostname, assetId })
    }
    await run('INSERT INTO uvm_finding_sync_runs (organization_id, run_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [HANASAND_ORGANIZATION_ID, scan.scanId])
}

async function importWebCheck({ scan, target, check, hostname, assetId }: {
    scan: WebScanRun
    target: WebScanRun['targets'][number]
    check: WebScanRun['targets'][number]['checks'][number]
    hostname: string
    assetId: string | null
}) {
    const externalId = `${target.target}:${check.id}`
    const fingerprint = createHash('sha256').update(`hanasand-web:${externalId}`).digest('hex')
    if (check.status === 'pass') {
        const resolved = await run(`UPDATE uvm_findings SET status = 'resolved', last_observed_run_id = $4, updated_at = NOW()
            WHERE organization_id = $1 AND engine = 'hanasand-web' AND external_id = $2
              AND COALESCE(asset_id, '') = COALESCE($3, '') AND status IN ('open', 'in_progress', 'pending_verification')
            RETURNING id`, [HANASAND_ORGANIZATION_ID, externalId, assetId, scan.scanId])
        if (resolved.rows[0]) await recordWebObservation(resolved.rows[0].id, scan, check)
        return
    }
    if (check.status !== 'warn' && check.status !== 'fail') return
    const saved = await run(`INSERT INTO uvm_findings (id, organization_id, asset_id, asset_label, engine, last_scan_profile,
            external_id, fingerprint, title, severity, description, evidence, first_seen, last_seen, last_observed_run_id)
        VALUES ($1, $2, $3, $4, 'hanasand-web', 'safe-web-checks', $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (organization_id, fingerprint) DO UPDATE SET
            title = EXCLUDED.title, severity = EXCLUDED.severity, description = EXCLUDED.description,
            evidence = EXCLUDED.evidence, first_seen = COALESCE(LEAST(uvm_findings.first_seen, EXCLUDED.first_seen), uvm_findings.first_seen, EXCLUDED.first_seen),
            last_seen = GREATEST(COALESCE(uvm_findings.last_seen, EXCLUDED.last_seen), EXCLUDED.last_seen),
            last_observed_run_id = EXCLUDED.last_observed_run_id,
            status = CASE WHEN uvm_findings.status IN ('resolved', 'pending_verification') THEN 'open' ELSE uvm_findings.status END,
            triage_note = CASE WHEN uvm_findings.status IN ('resolved', 'pending_verification') THEN NULL ELSE uvm_findings.triage_note END,
            updated_at = NOW() WHERE uvm_findings.last_observed_run_id IS DISTINCT FROM EXCLUDED.last_observed_run_id RETURNING id`,
    [randomUUID(), HANASAND_ORGANIZATION_ID, assetId, hostname, externalId, fingerprint, check.title, check.severity,
        check.explanation || null, JSON.stringify(check.evidence), scan.startedAt, scan.finishedAt || scan.startedAt, scan.scanId])
    const findingId = saved.rows[0]?.id || (await run('SELECT id FROM uvm_findings WHERE organization_id = $1 AND fingerprint = $2', [HANASAND_ORGANIZATION_ID, fingerprint])).rows[0]?.id
    if (!findingId) throw new Error('Web check finding upsert did not return a saved finding.')
    await recordWebObservation(findingId, scan, check)
}

async function recordWebObservation(findingId: string, scan: WebScanRun, check: WebScanRun['targets'][number]['checks'][number]) {
    await run(`INSERT INTO uvm_finding_observations (id, finding_id, organization_id, run_id, evidence, observed_at)
        VALUES ($1, $2, $3, $4, $5, COALESCE($6::timestamptz, NOW())) ON CONFLICT (finding_id, run_id) DO UPDATE SET evidence = EXCLUDED.evidence`,
    [randomUUID(), findingId, HANASAND_ORGANIZATION_ID, scan.scanId, JSON.stringify(check.evidence), scan.finishedAt])
}

function normalizeFindingSeverity(value: string) {
    const severity = value.toLowerCase()
    return ['critical', 'high', 'medium', 'low', 'info'].includes(severity) ? severity : 'unknown'
}
