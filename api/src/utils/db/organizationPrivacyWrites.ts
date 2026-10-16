import run from '#db'
import type { IdentityQuery } from './identityQueryTypes.ts'

export async function insertOrganizationPrivacyRequestIfAbsent(input: {
    id: string
    organizationId: string
    requestType: 'export' | 'deletion'
    status?: 'queued' | 'running' | 'completed' | 'failed'
    requestedBy: string | null
    requestId: string
    startedAt?: Date | string | null
}, query: IdentityQuery = run) {
    try {
        const result = await query(`
            INSERT INTO organization_privacy_requests (
                id, organization_id, request_type, status, requested_by, request_id, started_at
            ) VALUES ($1, $2, $3, COALESCE($4, 'queued'), $5, $6, $7)
            RETURNING id
        `, [input.id, input.organizationId, input.requestType, input.status ?? null,
            input.requestedBy, input.requestId, input.startedAt ?? null])
        return result.rows[0] ?? null
    } catch (error) {
        if ((error as { code?: string })?.code !== '23505') throw error
        return null
    }
}

export async function upsertOrganizationPrivacyDeletionRequest(input: {
    id: string
    organizationId: string
    requestedBy: string
    requestId: string
}, query: IdentityQuery = run) {
    const values = [input.id, input.organizationId, input.requestedBy, input.requestId]
    try {
        const inserted = await query(`
            INSERT INTO organization_privacy_requests (id, organization_id, request_type, requested_by, request_id)
            VALUES ($1, $2, 'deletion', $3, $4)
            RETURNING id
        `, values)
        return inserted.rows[0] ?? null
    } catch (error) {
        if ((error as { code?: string })?.code !== '23505') throw error
        const existing = await query(`
            SELECT id FROM organization_privacy_requests
             WHERE organization_id = $1 AND request_type = 'deletion' AND request_id = $2
             LIMIT 1
        `, [input.organizationId, input.requestId])
        if (existing.rows[0]) return existing.rows[0]
        throw error
    }
}
