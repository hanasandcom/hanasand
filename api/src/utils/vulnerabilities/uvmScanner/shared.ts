import { resolveTxt } from 'node:dns/promises'
import run from '#db'
import { HANASAND_ORGANIZATION_ID } from '#utils/auth/organizationPagePolicy.ts'
import ensureUvmScannerSchema from '#utils/db/uvmScannerSchema.ts'
import { parseAuthorizedAddresses } from '../uvmScope.ts'
import { getNetworkScannerRun } from '../uvmScannerClient.ts'

export const verificationPrefix = '_hanasand-security-verification'
export const scheduledScanRetryMinutes = 5
export const UVM_SCHEDULE_JOB_ID = 'api-uvm-scheduled-scans'

let schemaReady: Promise<void> | null = null

export type UvmAsset = {
    id: string
    hostname: string
    verificationStatus: 'pending' | 'verified' | 'disabled'
    verificationRecordName: string
    verificationRecordValue: string
    verificationMethod: 'dns_txt' | 'internal'
    verifiedAt: string | null
    scanAuthorizedAt: string | null
    authorizedAddresses: string[]
    scheduleEnabled: boolean
    scheduleEngine: 'nmap' | 'tenable-vm'
    scheduleScanId: string | null
    intervalMinutes: number
    nextRunAt: string | null
    createdAt: string
}

export type UvmAssetRecord = UvmAsset & { verificationToken: string }
export type NetworkScannerRun = Awaited<ReturnType<typeof getNetworkScannerRun>>
export type UvmFindingStatus = 'open' | 'in_progress' | 'pending_verification' | 'accepted_risk' | 'false_positive' | 'resolved'
export type UvmTriageStatus = Exclude<UvmFindingStatus, 'resolved'>

export async function ensureUvmSchema() {
    schemaReady ??= ensureUvmScannerSchema().catch(error => {
        schemaReady = null
        throw error
    })
    await schemaReady
}

export async function getAsset(id: string) {
    await ensureUvmSchema()
    const result = await run(`SELECT id, hostname, verification_method, verification_status, verified_at, scan_authorized_at,
            authorized_addresses, schedule_enabled, schedule_engine, schedule_scan_id, interval_minutes, next_run_at, created_at, verification_token
        FROM uvm_assets WHERE id = $1 AND organization_id = $2 AND verification_status <> 'disabled'`, [id, HANASAND_ORGANIZATION_ID])
    const row = result.rows[0]
    return row ? { ...toAsset(row), verificationToken: row.verification_token } : null
}

export async function verifyDomainControl(asset: UvmAssetRecord) {
    let records: string[][]
    try {
        records = await resolveTxt(`${verificationPrefix}.${asset.hostname}`)
    } catch (error) {
        if (!isMissingDnsRecord(error)) throw error
        records = []
    }
    if (!records.some(parts => parts.join('') === verificationValue(asset.verificationToken))) {
        await run(`UPDATE uvm_assets SET verification_status = 'pending', schedule_enabled = FALSE, next_run_at = NULL, updated_at = NOW()
            WHERE id = $1 AND organization_id = $2`, [asset.id, HANASAND_ORGANIZATION_ID])
        throw new Error('The domain verification TXT record is no longer present. Verify the asset again before scanning.')
    }
    return true
}

export function verificationValue(token: string) { return `hanasand-security-verification=${token}` }

export function toAsset(row: Record<string, any>): UvmAsset {
    return {
        id: row.id,
        hostname: row.hostname,
        verificationStatus: row.verification_status,
        verificationRecordName: `${verificationPrefix}.${row.hostname}`,
        verificationRecordValue: verificationValue(row.verification_token),
        verificationMethod: row.verification_method,
        verifiedAt: row.verified_at,
        scanAuthorizedAt: row.scan_authorized_at,
        authorizedAddresses: parseAuthorizedAddresses(row.authorized_addresses),
        scheduleEnabled: row.schedule_enabled,
        scheduleEngine: row.schedule_engine || 'nmap',
        scheduleScanId: row.schedule_scan_id || null,
        intervalMinutes: row.interval_minutes,
        nextRunAt: row.next_run_at,
        createdAt: row.created_at,
    }
}

export function errorMessage(error: unknown) { return error instanceof Error ? error.message : String(error) }

function isMissingDnsRecord(error: unknown) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
    return ['ENODATA', 'ENOTFOUND', 'NXDOMAIN'].includes(code)
}
