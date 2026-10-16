import run from '#db'
import { ensureColumn, ensureConstraint } from './existingSchema.ts'

export default async function ensureVmLifecycleSchema() {
    await ensureColumn(run, 'vms', 'always_running_premium', 'ALTER TABLE vms ADD COLUMN IF NOT EXISTS always_running_premium BOOLEAN NOT NULL DEFAULT FALSE')
    await ensureColumn(run, 'vms', 'always_running_enabled', 'ALTER TABLE vms ADD COLUMN IF NOT EXISTS always_running_enabled BOOLEAN NOT NULL DEFAULT FALSE')
    await ensureColumn(run, 'vms', 'failover_premium', 'ALTER TABLE vms ADD COLUMN IF NOT EXISTS failover_premium BOOLEAN NOT NULL DEFAULT FALSE')
    await ensureColumn(run, 'vms', 'failover_enabled', 'ALTER TABLE vms ADD COLUMN IF NOT EXISTS failover_enabled BOOLEAN NOT NULL DEFAULT FALSE')
    await ensureColumn(run, 'vms', 'primary_host', 'ALTER TABLE vms ADD COLUMN IF NOT EXISTS primary_host TEXT NOT NULL DEFAULT $$ovhcloud$$')
    await ensureColumn(run, 'vms', 'failover_host', 'ALTER TABLE vms ADD COLUMN IF NOT EXISTS failover_host TEXT')
    await ensureColumn(run, 'vms', 'deleted_at', 'ALTER TABLE vms ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ')
    await ensureColumn(run, 'vms', 'delete_after', 'ALTER TABLE vms ADD COLUMN IF NOT EXISTS delete_after TIMESTAMPTZ')
    await ensureColumn(run, 'vms', 'deletion_restore', 'ALTER TABLE vms ADD COLUMN IF NOT EXISTS deletion_restore JSONB')
    await ensureColumn(run, 'vms', 'deletion_error', 'ALTER TABLE vms ADD COLUMN IF NOT EXISTS deletion_error TEXT')
    if ((process.env.VM_HOST_ID || '') === 'inspur') {
        await run(`
                UPDATE vms v
                SET primary_host = 'inspur'
                WHERE LOWER(COALESCE(v.primary_host, '')) = 'ovhcloud'
                  AND EXISTS (SELECT 1 FROM vm_details d WHERE LOWER(d.name) = LOWER(v.name))
            `)
    }
    await ensureConstraint(run, 'vm_details', 'vm_details_name_fkey', 'FOREIGN KEY (name) REFERENCES vms(name) ON UPDATE CASCADE ON DELETE CASCADE',
        'ALTER TABLE vm_details DROP CONSTRAINT IF EXISTS vm_details_name_fkey; ALTER TABLE vm_details ADD CONSTRAINT vm_details_name_fkey FOREIGN KEY (name) REFERENCES vms(name) ON DELETE CASCADE ON UPDATE CASCADE')
}
