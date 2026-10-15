import { expect, test } from 'bun:test'
import { hasOrganizationPrivacyDeletionMarker, organizationPrivacyDeletionInProgress } from '../src/utils/organizationLifecycle.ts'

test('privacy deletion lock is shared by organization and support write guards', () => {
    expect(organizationPrivacyDeletionInProgress({ audit_safe_metadata: { privacyDeletionRunId: 'run-1' } } as any)).toBe(true)
    expect(organizationPrivacyDeletionInProgress({ audit_safe_metadata: {} } as any)).toBe(false)
    expect(organizationPrivacyDeletionInProgress({ audit_safe_metadata: null } as any)).toBe(false)
})

test('support access-recovery keeps the database marker-presence check', async () => {
    let statement = ''
    let params: unknown[] = []
    const query = async (sql: string, values?: unknown[]) => {
        statement = sql
        params = values ?? []
        return { rows: [{ locked: true }] }
    }
    expect(await hasOrganizationPrivacyDeletionMarker('org-1', query as any)).toBe(true)
    expect(statement).toContain('audit_safe_metadata ? \'privacyDeletionRunId\'')
    expect(params).toEqual(['org-1'])
})
