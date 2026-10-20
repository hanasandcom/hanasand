import ensureRuleHitCountSchema from './ruleHitCountSchema.ts'
import { queryOnce, withDatabaseAdvisoryLock, withSchemaLockTimeout, withTransaction } from '#db'
import { ensureIdentityDataBoundary } from './identityDataBoundary.ts'
import ensurePlatformSchema from './platformSchema.ts'
import ensureLoadTestSchema from './loadTestSchema.ts'
import ensureBrowserBillingSchema from './browserBillingSchema.ts'
import ensureBrowserRunSchema from './browserRunSchema.ts'
import ensureSupportSchema from './supportSchema.ts'
import ensureAccountDeletionSchema from './accountDeletionSchema.ts'
import ensureVmLifecycleSchema from './vmLifecycleSchema.ts'
import ensureVmPublicPortsSchema from './vmPublicPortsSchema.ts'
import ensureReservedAccountSchema from './reservedAccountSchema.ts'
import ensureAuthenticationSchema from './authenticationSchema.ts'
import ensureShareSchema from './shareSchema.ts'
import ensurePasswordResetSchema from './passwordResetSchema.ts'
import ensureOperationsMonitoringSchema from './operationsMonitoringSchema.ts'
import ensureWebScanSchema from './webScanSchema.ts'
import ensureTrafficDesktopSchema from './trafficDesktopSchema.ts'
import ensureAgentAutomationSchema from './agentAutomationSchema.ts'
import ensureCaseDevelopmentSchema from './caseDevelopmentSchema.ts'
import ensureMonitoringIssuesSchema from './monitoringIssuesSchema.ts'
import ensureNotesSchema from './notesSchema.ts'
import ensureOrganizationSchema from './organizationSchema.ts'
import ensureOrganizationPrivacySchema from './organizationPrivacySchema.ts'
import ensureSystemAuditSchema from './systemAuditSchema.ts'
import ensureApiAccessSchema from './apiAccessSchema.ts'
import ensureEventLogSchema from './eventLogSchema.ts'
import ensureRulesFindingsSchema from './rulesFindingsSchema.ts'
import ensureMailSchema from './mailSchema.ts'
import ensureOrganizationAdaptersSchema from './organizationAdaptersSchema.ts'
import { applyTrackedSchemaRelease, vmHostMigrationReleaseMarker } from './schemaReleasePolicy.ts'
import { backfillVmHostAssignments } from './vmHostBackfill.ts'
import { resolveVmHostId } from '../vms/hostConfig.ts'

export default async function ensureSchema() {
    // This migration removes the legacy global receipt-write advisory lock.
    // Keep it outside the per-release marker check so an already-applied
    // release cannot leave receipt writers serialized indefinitely.
    await ensureExistingRuleHitCountSchema()
    const release = process.env.HANASAND_RELEASE_COMMIT
    const trackedRelease = release && /^[a-f0-9]{40}$/.test(release) ? release : undefined
    const vmHostId = resolveVmHostId()
    const hostMigrationRelease = vmHostMigrationReleaseMarker(trackedRelease, vmHostId)
    const deploymentCandidate = process.env.DEPLOYMENT_CANDIDATE_ONLY === '1'
    if (trackedRelease) {
        const result = await applyTrackedSchemaRelease(trackedRelease, hostMigrationRelease, withDatabaseAdvisoryLock,
            () => applySchemaWithRetry(deploymentCandidate),
            () => retrySchemaLockTimeout(
                () => withSchemaLockTimeout(() => backfillVmHostAssignments(vmHostId, queryOnce)),
                'VM host assignment migration deferred because it exceeded its lock or execution limit',
            ))
        if (result !== 'schema-applied' && !deploymentCandidate) await ensureIdentityDataBoundaryWithRetry()
        scheduleLegacyEventConstraintCleanup()
        return
    }
    await applySchemaWithRetry(deploymentCandidate)
    scheduleLegacyEventConstraintCleanup()
}

async function applySchemaWithRetry(deploymentCandidate: boolean) {
    await retrySchemaLockTimeout(async() => {
        await withSchemaLockTimeout(applySchema)
        if (!deploymentCandidate) await ensureIdentityDataBoundaryWithRetry()
    }, 'Schema update deferred because it exceeded its lock or execution limit')
}

async function retrySchemaLockTimeout(work: () => Promise<unknown>, context: string) {
    for (;;) {
        try {
            await work()
            return
        } catch (error) {
            const code = (error as { code?: string })?.code
            if (code !== '55P03' && code !== '57014') throw error
            console.warn(`${context}; retrying in 30 seconds.`)
            await new Promise(resolve => setTimeout(resolve, 30_000))
        }
    }
}

let legacyEventConstraintCleanupScheduled = false
function scheduleLegacyEventConstraintCleanup() {
    if (legacyEventConstraintCleanupScheduled) return
    legacyEventConstraintCleanupScheduled = true

    const attempt = async () => {
        try {
            await withTransaction(async query => {
                await query('SET LOCAL lock_timeout = \'1ms\'')
                const exists = await query(`SELECT 1 FROM pg_constraint
                    WHERE conrelid=to_regclass('public.events')
                      AND conname='events_organization_id_ingestion_id_id_key'`)
                if (!exists.rowCount) return
                await query('ALTER TABLE events DROP CONSTRAINT events_organization_id_ingestion_id_id_key')
            }, { timeoutMs: 3000, statementTimeoutMs: 3000 })
            return
        } catch (error) {
            if ((error as { code?: string })?.code !== '55P03') {
                console.warn('Deferred redundant events constraint cleanup failed; it will retry.', error)
            }
        }

        const timer = setTimeout(attempt, 60_000)
        timer.unref()
    }

    const timer = setTimeout(attempt, 60_000)
    timer.unref()
}

async function ensureExistingRuleHitCountSchema() {
    const relations = (await queryOnce(`SELECT
        to_regclass('public.findings') IS NOT NULL AS findings,
        to_regclass('public.log_analyze_receipts') IS NOT NULL AS receipts,
        to_regclass('public.rule_hit_count_state') IS NOT NULL AS state`)).rows[0]
    if (!relations?.findings || !relations.receipts || !relations.state) return
    const initialized = await queryOnce('SELECT initialized FROM rule_hit_count_state WHERE id=TRUE')
    if (initialized.rows[0]?.initialized) await ensureRuleHitCountSchema()
}

async function ensureIdentityDataBoundaryWithRetry() {
    await retrySchemaLockTimeout(
        () => withSchemaLockTimeout(ensureIdentityDataBoundary),
        'Identity data boundary is waiting for database locks',
    )
}

async function applySchema() {
    await ensurePlatformSchema()
    await ensureLoadTestSchema()
    await ensureBrowserBillingSchema()
    await ensureBrowserRunSchema()
    await ensureSupportSchema()
    await ensureAccountDeletionSchema()
    await ensureVmLifecycleSchema()
    await ensureVmPublicPortsSchema()
    await ensureReservedAccountSchema()
    await ensureAuthenticationSchema()
    await ensureShareSchema()
    await ensurePasswordResetSchema()
    await ensureOperationsMonitoringSchema()
    await ensureWebScanSchema()
    await ensureTrafficDesktopSchema()
    await ensureAgentAutomationSchema()
    await ensureCaseDevelopmentSchema()
    await ensureMonitoringIssuesSchema()
    await ensureNotesSchema()
    await ensureOrganizationSchema()
    await ensureOrganizationPrivacySchema()
    await ensureSystemAuditSchema()
    await ensureApiAccessSchema()
    await ensureEventLogSchema()
    await ensureRulesFindingsSchema()
    await ensureMailSchema()
    await ensureOrganizationAdaptersSchema()
}
