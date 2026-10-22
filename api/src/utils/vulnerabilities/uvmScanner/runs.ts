import { randomUUID } from 'node:crypto'
import run from '#db'
import { HANASAND_ORGANIZATION_ID } from '#utils/auth/organizationPagePolicy.ts'
import { resolvePublicUvmAddresses, sameAuthorizedAddressSet } from '../uvmScope.ts'
import {
    cancelNetworkScannerRun, cancelTenableRun, getNetworkScannerRun, getTenableIntegration, getTenableScans,
    getTenableRun, removeTenableIntegration, setTenableIntegration, startNetworkScannerRun, startTenableRun,
} from '../scanner.ts'
import {
    ensureUvmSchema, errorMessage, getAsset, scheduledScanRetryMinutes, verifyDomainControl,
} from './shared.ts'

export async function configureUvmTenable(input: { region: 'us' | 'eu' | 'de' | 'au' | 'ca' | 'jp', accessKey: string, secretKey: string }) {
    return setTenableIntegration(HANASAND_ORGANIZATION_ID, input)
}

export async function disconnectUvmTenable() {
    await removeTenableIntegration(HANASAND_ORGANIZATION_ID)
    return getTenableIntegration(HANASAND_ORGANIZATION_ID)
}

export async function startUvmTenableScan(input: { assetId: string, actorId: string, scanId: string, authorized: boolean, source?: 'manual' | 'scheduled' }) {
    await ensureUvmSchema()
    const asset = await getAsset(input.assetId)
    if (!asset || asset.verificationStatus !== 'verified') throw new Error('Choose a verified asset before starting a scan.')
    const scanId = input.scanId.trim()
    if (!scanId) throw new Error('Choose an enabled Tenable scan configuration.')
    const configuredScans = await getTenableScans(HANASAND_ORGANIZATION_ID)
    if (!configuredScans.scans.some(scan => scan.id === scanId && scan.enabled)) throw new Error('The selected Tenable scan configuration is unavailable or disabled. Choose an enabled configuration.')
    if (asset.verificationMethod !== 'internal') await verifyDomainControl(asset)
    const addresses = await resolvePublicUvmAddresses(asset.hostname)
    const consentMatchesAddresses = sameAuthorizedAddressSet(asset.authorizedAddresses, addresses)
    if (!input.authorized && !consentMatchesAddresses) throw new Error('The resolved IP addresses changed or have not been authorized. Confirm that you are authorized to scan the current addresses.')
    const requestId = randomUUID()
    const localId = randomUUID()
    const source = input.source || 'manual'
    const inserted = await run(`INSERT INTO uvm_tenable_runs (id, organization_id, asset_id, request_id, scan_id, source, status, actor_id)
        VALUES ($1, $2, $3, $4, $5, $6, 'queued', $7) RETURNING id`,
    [localId, HANASAND_ORGANIZATION_ID, asset.id, requestId, scanId, source, input.actorId])
    try {
        const remote = await startTenableRun({ organizationId: HANASAND_ORGANIZATION_ID, assetId: asset.id, requestId, target: asset.hostname, addresses, scanId })
        await run('UPDATE uvm_tenable_runs SET scanner_run_id = $2, status = $3, started_at = $4 WHERE id = $1', [localId, remote.runId, remote.status, remote.startedAt || null])
        if (input.authorized) await run('UPDATE uvm_assets SET scan_authorized_at = NOW(), scan_authorized_by = $2, authorized_addresses = $3::jsonb, updated_at = NOW() WHERE id = $1', [asset.id, input.actorId, JSON.stringify(addresses)])
        return { ...remote, id: inserted.rows[0].id, assetId: asset.id, target: asset.hostname, engine: 'tenable-vm', profile: scanId, source }
    } catch (error) {
        await run('UPDATE uvm_tenable_runs SET status = \'failed\', error = $2, finished_at = NOW() WHERE id = $1', [localId, errorMessage(error)])
        throw error
    }
}

export async function getUvmTenableRun(localRunId: string) {
    await ensureUvmSchema()
    const result = await run('SELECT scanner_run_id, request_id FROM uvm_tenable_runs WHERE id = $1 AND organization_id = $2', [localRunId, HANASAND_ORGANIZATION_ID])
    if (!result.rows[0]) return null
    if (!result.rows[0].scanner_run_id) return { id: localRunId, status: 'queued', requestId: result.rows[0].request_id }
    return { id: localRunId, ...await getTenableRun(result.rows[0].scanner_run_id, HANASAND_ORGANIZATION_ID) }
}

export async function cancelUvmTenableRun(localRunId: string) {
    await ensureUvmSchema()
    const result = await run('SELECT scanner_run_id FROM uvm_tenable_runs WHERE id = $1 AND organization_id = $2', [localRunId, HANASAND_ORGANIZATION_ID])
    if (!result.rows[0]) return null
    if (!result.rows[0].scanner_run_id) throw new Error('The scan request is still being submitted. Try cancelling again shortly.')
    return cancelTenableRun(result.rows[0].scanner_run_id, HANASAND_ORGANIZATION_ID)
}

export async function startUvmNetworkScan(input: { assetId: string, actorId: string, source: 'manual' | 'scheduled', authorized: boolean }) {
    await ensureUvmSchema()
    const asset = await getAsset(input.assetId)
    if (!asset || asset.verificationStatus !== 'verified') throw new Error('Choose a verified asset before starting a scan.')
    if (asset.verificationMethod !== 'internal') await verifyDomainControl(asset)
    const addresses = await resolvePublicUvmAddresses(asset.hostname)
    const consentMatchesAddresses = sameAuthorizedAddressSet(asset.authorizedAddresses, addresses)
    if (!input.authorized && !consentMatchesAddresses) throw new Error('The resolved IP addresses changed or have not been authorized. Confirm that you are authorized to scan the current addresses.')
    const requestId = randomUUID()
    const localId = randomUUID()
    const inserted = await run(`INSERT INTO uvm_network_runs (id, organization_id, asset_id, request_id, engine, profile, source, status, actor_id)
        VALUES ($1, $2, $3, $4, 'nmap', 'tcp-top-100', $5, 'queued', $6) RETURNING id`,
    [localId, HANASAND_ORGANIZATION_ID, asset.id, requestId, input.source, input.actorId])
    try {
        const remote = await startNetworkScannerRun({ organizationId: HANASAND_ORGANIZATION_ID, assetId: asset.id, requestId, target: asset.hostname, addresses, profile: 'tcp-top-100' })
        await run('UPDATE uvm_network_runs SET scanner_run_id = $2, status = $3, started_at = $4 WHERE id = $1', [localId, remote.runId, remote.status, remote.startedAt || null])
        if (input.authorized) await run('UPDATE uvm_assets SET scan_authorized_at = NOW(), scan_authorized_by = $2, authorized_addresses = $3::jsonb, updated_at = NOW() WHERE id = $1', [asset.id, input.actorId, JSON.stringify(addresses)])
        return { ...remote, id: inserted.rows[0].id, assetId: asset.id, target: asset.hostname, engine: 'nmap', profile: 'tcp-top-100', source: input.source }
    } catch (error) {
        await run('UPDATE uvm_network_runs SET status = \'failed\', error = $2, finished_at = NOW() WHERE id = $1', [localId, errorMessage(error)])
        throw error
    }
}

export async function getUvmNetworkRun(localRunId: string) {
    await ensureUvmSchema()
    const result = await run('SELECT scanner_run_id, request_id FROM uvm_network_runs WHERE id = $1 AND organization_id = $2', [localRunId, HANASAND_ORGANIZATION_ID])
    if (!result.rows[0]) return null
    if (!result.rows[0].scanner_run_id) return { id: localRunId, status: 'queued', requestId: result.rows[0].request_id }
    return { id: localRunId, ...await getNetworkScannerRun(result.rows[0].scanner_run_id, HANASAND_ORGANIZATION_ID) }
}

export async function cancelUvmRun(localRunId: string) {
    await ensureUvmSchema()
    const result = await run('SELECT scanner_run_id FROM uvm_network_runs WHERE id = $1 AND organization_id = $2', [localRunId, HANASAND_ORGANIZATION_ID])
    if (result.rows[0]) {
        if (!result.rows[0].scanner_run_id) throw new Error('The scan request is still being submitted. Try cancelling again shortly.')
        return cancelNetworkScannerRun(result.rows[0].scanner_run_id, HANASAND_ORGANIZATION_ID)
    }
    const tenable = await run('SELECT scanner_run_id FROM uvm_tenable_runs WHERE id = $1 AND organization_id = $2', [localRunId, HANASAND_ORGANIZATION_ID])
    if (!tenable.rows[0]) return null
    if (!tenable.rows[0].scanner_run_id) throw new Error('The scan request is still being submitted. Try cancelling again shortly.')
    return cancelTenableRun(tenable.rows[0].scanner_run_id, HANASAND_ORGANIZATION_ID)
}

export async function runDueUvmScans() {
    await ensureUvmSchema()
    const result = await run(`UPDATE uvm_assets SET next_run_at = NOW() + (interval_minutes * INTERVAL '1 minute'), updated_at = NOW()
        WHERE id = (
            SELECT id FROM uvm_assets
            WHERE organization_id = $1 AND verification_status = 'verified' AND schedule_enabled IS TRUE
              AND scan_authorized_at IS NOT NULL AND next_run_at <= NOW()
            ORDER BY next_run_at FOR UPDATE SKIP LOCKED LIMIT 1
        )
        RETURNING id, created_by, schedule_engine, schedule_scan_id`, [HANASAND_ORGANIZATION_ID])
    const asset = result.rows[0]
    if (!asset) return
    try {
        if (asset.schedule_engine === 'tenable-vm') {
            await startUvmTenableScan({ assetId: asset.id, actorId: asset.created_by, scanId: asset.schedule_scan_id || '', source: 'scheduled', authorized: false })
        } else {
            await startUvmNetworkScan({ assetId: asset.id, actorId: asset.created_by, source: 'scheduled', authorized: false })
        }
    } catch (error) {
        const message = errorMessage(error)
        if (message.startsWith('The resolved IP addresses changed')) {
            await run(`UPDATE uvm_assets SET schedule_enabled = FALSE, next_run_at = NULL, updated_at = NOW()
                WHERE id = $1 AND organization_id = $2`, [asset.id, HANASAND_ORGANIZATION_ID])
        } else {
            await run(`UPDATE uvm_assets SET next_run_at = NOW() + ($3 * INTERVAL '1 minute'), updated_at = NOW()
                WHERE id = $1 AND organization_id = $2 AND schedule_enabled IS TRUE`,
            [asset.id, HANASAND_ORGANIZATION_ID, scheduledScanRetryMinutes])
        }
        console.error('Scheduled UVM scan could not start', { assetId: asset.id, engine: asset.schedule_engine || 'nmap', error: message })
    }
}
