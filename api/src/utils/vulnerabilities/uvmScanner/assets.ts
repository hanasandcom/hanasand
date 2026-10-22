import { randomBytes, randomUUID } from 'node:crypto'
import { resolveTxt } from 'node:dns/promises'
import run from '#db'
import { HANASAND_ORGANIZATION_ID } from '#utils/auth/organizationPagePolicy.ts'
import { normalizeUvmHostname, resolvePublicUvmAddresses, sameAuthorizedAddressSet } from '../uvmScope.ts'
import { getTenableScans } from '../scanner.ts'
import { ensureUvmSchema, getAsset, toAsset, verificationPrefix, verificationValue, type UvmAsset } from './shared.ts'

export async function listUvmAssets(): Promise<UvmAsset[]> {
    await ensureUvmSchema()
    const result = await run(`SELECT id, hostname, verification_method, verification_status, verified_at,
            scan_authorized_at, authorized_addresses, schedule_enabled, schedule_engine, schedule_scan_id, interval_minutes, next_run_at, created_at, verification_token
        FROM uvm_assets WHERE organization_id = $1 AND verification_status <> 'disabled'
        ORDER BY hostname`, [HANASAND_ORGANIZATION_ID])
    return result.rows.map(row => toAsset(row))
}

export async function createUvmAsset(hostnameValue: unknown, actorId: string) {
    await ensureUvmSchema()
    const hostname = normalizeUvmHostname(hostnameValue)
    const id = randomUUID()
    const token = randomBytes(24).toString('base64url')
    const result = await run(`INSERT INTO uvm_assets (id, organization_id, hostname, verification_token, created_by)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (organization_id, hostname) DO UPDATE SET updated_at = NOW()
        RETURNING id, hostname, verification_method, verification_status, verified_at, scan_authorized_at,
            authorized_addresses, schedule_enabled, schedule_engine, schedule_scan_id, interval_minutes, next_run_at, created_at, verification_token`,
    [id, HANASAND_ORGANIZATION_ID, hostname, token, actorId])
    return toAsset(result.rows[0])
}

export async function verifyUvmAsset(assetId: string) {
    const asset = await getAsset(assetId)
    if (!asset) return null
    if (asset.verificationMethod === 'internal') {
        const safeAsset = { ...asset }
        delete safeAsset.verificationToken
        return safeAsset
    }
    const name = `${verificationPrefix}.${asset.hostname}`
    let records: string[][]
    try {
        records = await resolveTxt(name)
    } catch (error) {
        const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
        if (!['ENODATA', 'ENOTFOUND', 'NXDOMAIN'].includes(code)) throw error
        records = []
    }
    const found = records.some(parts => parts.join('') === verificationValue(asset.verificationToken))
    const status = found ? 'verified' : 'pending'
    const result = await run(`UPDATE uvm_assets SET verification_status = $3,
            verified_at = CASE WHEN $3 = 'verified' THEN COALESCE(verified_at, NOW()) ELSE verified_at END,
            schedule_enabled = CASE WHEN $3 = 'pending' THEN FALSE ELSE schedule_enabled END,
            next_run_at = CASE WHEN $3 = 'pending' THEN NULL ELSE next_run_at END, updated_at = NOW()
        WHERE id = $1 AND organization_id = $2
        RETURNING id, hostname, verification_method, verification_status, verified_at, scan_authorized_at,
            authorized_addresses, schedule_enabled, schedule_engine, schedule_scan_id, interval_minutes, next_run_at, created_at, verification_token`,
    [assetId, HANASAND_ORGANIZATION_ID, status])
    return result.rows[0] ? toAsset(result.rows[0]) : null
}

export async function updateUvmSchedule(input: {
    assetId: string
    enabled: boolean
    intervalMinutes: number
    authorized: boolean
    engine?: 'nmap' | 'tenable-vm'
    scanId?: string
    actorId: string
}) {
    await ensureUvmSchema()
    const engine = input.engine || 'nmap'
    if (!['nmap', 'tenable-vm'].includes(engine)) throw new Error('Choose a supported scan engine.')
    const asset = await getAsset(input.assetId)
    if (!asset) return null
    if (input.enabled && asset.verificationStatus !== 'verified') throw new Error('Verify the domain before enabling scheduled scans.')
    let scanId: string | null = null
    if (input.enabled && engine === 'tenable-vm') {
        scanId = typeof input.scanId === 'string' ? input.scanId.trim() : ''
        if (!scanId) throw new Error('Choose an enabled Tenable scan configuration for this schedule.')
        const configuredScans = await getTenableScans(HANASAND_ORGANIZATION_ID)
        if (!configuredScans.scans.some(scan => scan.id === scanId && scan.enabled)) throw new Error('The selected Tenable scan configuration is unavailable or disabled. Choose an enabled configuration.')
    }
    const addresses = input.enabled ? await resolvePublicUvmAddresses(asset.hostname) : []
    const consentMatchesAddresses = input.enabled && sameAuthorizedAddressSet(asset.authorizedAddresses, addresses)
    if (input.enabled && !input.authorized && !consentMatchesAddresses) throw new Error('Confirm authorization for the current resolved IP addresses before enabling this schedule.')
    const nextRunAt = input.enabled ? new Date(Date.now() + input.intervalMinutes * 60_000).toISOString() : null
    const result = await run(`UPDATE uvm_assets SET schedule_enabled = $3, interval_minutes = $4,
            schedule_engine = $9, schedule_scan_id = $10,
            scan_authorized_at = CASE WHEN $5 THEN NOW() ELSE scan_authorized_at END,
            scan_authorized_by = CASE WHEN $5 THEN $6 ELSE scan_authorized_by END,
            authorized_addresses = CASE WHEN $5 THEN $8::jsonb ELSE authorized_addresses END,
            next_run_at = $7, updated_at = NOW()
        WHERE id = $1 AND organization_id = $2
        RETURNING id, hostname, verification_method, verification_status, verified_at, scan_authorized_at,
            authorized_addresses, schedule_enabled, schedule_engine, schedule_scan_id, interval_minutes, next_run_at, created_at, verification_token`,
    [input.assetId, HANASAND_ORGANIZATION_ID, input.enabled, input.intervalMinutes, input.authorized, input.actorId, nextRunAt, JSON.stringify(addresses), engine, scanId])
    return result.rows[0] ? toAsset(result.rows[0]) : null
}
