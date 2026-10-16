import ensureRuleHitCountSchema from './ruleHitCountSchema.ts'
import { queryOnce, withSchemaLockTimeout, withTransaction } from '#db'
import { ensureIdentityDataBoundary } from './identityDataBoundary.ts'
import ensurePlatformSchema from './platformSchema.ts'
import ensureLoadTestSchema from './loadTestSchema.ts'
import ensureBrowserBillingSchema from './browserBillingSchema.ts'
import ensureBrowserRunSchema from './browserRunSchema.ts'
import ensureSupportSchema from './supportSchema.ts'
import ensureAccountDeletionSchema from './accountDeletionSchema.ts'
import ensureVmLifecycleSchema from './vmLifecycleSchema.ts'
import ensureReservedAccountSchema from './reservedAccountSchema.ts'
import ensureAuthenticationSchema from './authenticationSchema.ts'
import ensureImpersonationSchema from './impersonationSchema.ts'
import ensureShareSchema from './shareSchema.ts'
import ensurePasswordResetSchema from './passwordResetSchema.ts'
import ensureOperationsMonitoringSchema from './operationsMonitoringSchema.ts'
import ensureWebScanSchema from './webScanSchema.ts'
import ensureTrafficDesktopSchema from './trafficDesktopSchema.ts'
import ensureAiWorkspaceSchema from './aiWorkspaceSchema.ts'
import ensureAgentAutomationSchema from './agentAutomationSchema.ts'
import ensureAiDeploymentSchema from './aiDeploymentSchema.ts'
import ensureOrganizationSchema from './organizationSchema.ts'
import ensureOrganizationPrivacySchema from './organizationPrivacySchema.ts'
import ensureSystemAuditSchema from './systemAuditSchema.ts'
import ensureAiUsageSchema from './aiUsageSchema.ts'
import ensureApiAccessSchema from './apiAccessSchema.ts'
import ensureEventLogSchema from './eventLogSchema.ts'
import ensureRulesFindingsSchema from './rulesFindingsSchema.ts'
import ensureMailSchema from './mailSchema.ts'
import ensureOrganizationAdaptersSchema from './organizationAdaptersSchema.ts'

export default async function ensureSchema() {
    // This migration removes the legacy global receipt-write advisory lock.
    // Keep it outside the per-release marker check so an already-applied
    // release cannot leave receipt writers serialized indefinitely.
    await ensureExistingRuleHitCountSchema()
    const release = process.env.HANASAND_RELEASE_COMMIT
    const trackedRelease = release && /^[a-f0-9]{40}$/.test(release) ? release : undefined
    const deploymentCandidate = process.env.DEPLOYMENT_CANDIDATE_ONLY === '1'
    if (trackedRelease) {
        try {
            const result = await queryOnce('SELECT 1 FROM app_schema_releases WHERE release = $1', [trackedRelease])
            if (result.rowCount) {
                scheduleLegacyEventConstraintCleanup()
                if (!deploymentCandidate) await ensureIdentityDataBoundaryWithRetry()
                return
            }
        } catch (error) {
            if ((error as { code?: string })?.code !== '42P01') throw error
        }
    }
    await retrySchemaLockTimeout(async() => {
        await withSchemaLockTimeout(applySchema)
        if (!deploymentCandidate) await ensureIdentityDataBoundaryWithRetry()
        if (trackedRelease) await withSchemaLockTimeout(async () => {
            await queryOnce('CREATE TABLE IF NOT EXISTS app_schema_releases (release TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())')
            await queryOnce('INSERT INTO app_schema_releases (release) VALUES ($1) ON CONFLICT DO NOTHING', [trackedRelease])
        })
        scheduleLegacyEventConstraintCleanup()
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
    await ensureReservedAccountSchema()
    await ensureAuthenticationSchema()
    await ensureImpersonationSchema()
    await ensureShareSchema()
    await ensurePasswordResetSchema()
    await ensureOperationsMonitoringSchema()
    await ensureWebScanSchema()
    await ensureTrafficDesktopSchema()
    await ensureAiWorkspaceSchema()
    await ensureAgentAutomationSchema()
    await ensureAiDeploymentSchema()
    await ensureOrganizationSchema()
    await ensureOrganizationPrivacySchema()
    await ensureSystemAuditSchema()
    await ensureAiUsageSchema()
    await ensureApiAccessSchema()
    await ensureEventLogSchema()
    await ensureRulesFindingsSchema()
    await ensureMailSchema()
    await ensureOrganizationAdaptersSchema()
}
