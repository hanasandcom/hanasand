import { queryOnce } from '#db'
import type { RetentionItem, RetentionRun } from './organizationPrivacyPolicy.ts'

export async function mutateAndRecord(mutation: string, mutationParams: Array<string | string[]>, retentionRun: RetentionRun, item: RetentionItem) {
    const offset = mutationParams.length
    const recorded = await queryOnce(`
        WITH mutated AS (${mutation})
        INSERT INTO organization_retention_run_items (
            run_id, organization_id, source_service, record_type, record_id,
            action, status, reason, error
        )
        SELECT $${offset + 1}, $${offset + 2}, 'hanasand-api', $${offset + 3}, mutated.id, $${offset + 4}, $${offset + 5}, $${offset + 6}, NULL
          FROM mutated
        ON CONFLICT (run_id, source_service, record_type, record_id)
        DO UPDATE SET action = EXCLUDED.action, status = EXCLUDED.status,
                      reason = EXCLUDED.reason, error = NULL,
                      attempt_count = organization_retention_run_items.attempt_count + 1,
                      processed_at = NOW()
        RETURNING record_id
    `, [...mutationParams, retentionRun.id, retentionRun.organization_id, item.recordType, item.action, item.status, item.reason])
    if (!recorded.rows[0]) throw new Error(`Eligible ${item.recordType} changed before the retention mutation; retrying safely.`)
}

export async function saveRetentionItems(retentionRun: RetentionRun, retentionItems: RetentionItem[]) {
    for (const item of retentionItems) {
        await queryOnce(`
            INSERT INTO organization_retention_run_items (
                run_id, organization_id, source_service, record_type, record_id,
                action, status, reason, error
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (run_id, source_service, record_type, record_id)
            DO UPDATE SET action = EXCLUDED.action, status = EXCLUDED.status,
                          reason = EXCLUDED.reason, error = EXCLUDED.error,
                          attempt_count = organization_retention_run_items.attempt_count + 1,
                          processed_at = NOW()
        `, [retentionRun.id, retentionRun.organization_id, item.sourceService, item.recordType, item.recordId, item.action, item.status, item.reason, item.error ?? null])
    }
}
