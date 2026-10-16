import type run from '#db'
import { ensureColumnNullable, ensureConstraint } from './existingSchema.ts'

export async function ensureOrganizationCreatorReferenceSchema(query: typeof run) {
    await ensureColumnNullable(query, 'organizations', 'created_by', 'ALTER TABLE organizations ALTER COLUMN created_by DROP NOT NULL')
    await ensureConstraint(query, 'organizations', 'organizations_created_by_fkey', 'FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL',
        'ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_created_by_fkey; ALTER TABLE organizations ADD CONSTRAINT organizations_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL')
}

export async function ensureOrganizationApiKeyOwnerSchema(query: typeof run) {
    await ensureColumnNullable(query, 'api_keys', 'owner_id', 'ALTER TABLE api_keys ALTER COLUMN owner_id DROP NOT NULL')
    await ensureConstraint(query, 'api_keys', 'api_keys_owner_id_fkey', 'FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL',
        'ALTER TABLE api_keys DROP CONSTRAINT IF EXISTS api_keys_owner_id_fkey; ALTER TABLE api_keys ADD CONSTRAINT api_keys_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL')
    await query('DROP INDEX IF EXISTS idx_api_keys_one_active_org')
}
