import type { SchemaReleaseQuery } from './schemaReleasePolicy.ts'

export const inspurVmHostBackfillSql = `UPDATE vms v
    SET primary_host = 'inspur'
    WHERE LOWER(COALESCE(v.primary_host, '')) = 'ovhcloud'
      AND EXISTS (SELECT 1 FROM vm_details d WHERE LOWER(d.name) = LOWER(v.name))`

export async function backfillVmHostAssignments(host: string | undefined, query: SchemaReleaseQuery) {
    if (host !== 'inspur') return false
    await query(inspurVmHostBackfillSql)
    return true
}
