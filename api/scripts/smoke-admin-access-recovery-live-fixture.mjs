import crypto from 'crypto'
import pg from 'pg'

const hanasandOrganizationId = '3e735e7b-4d7f-444d-9806-231fa26cfcec'
const { Pool } = pg

export function createSmokeContext({ dbPassword }) {
    const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 10)
    const adminOneId = `admin_support_${suffix}_requester`
    const adminTwoId = `admin_support_${suffix}_approver`
    return {
        suffix,
        apiBase: process.env.API_BASE || 'http://127.0.0.1:8080/api',
        adminOneId,
        adminTwoId,
        adminOneToken: '',
        adminTwoToken: '',
        orgId: `admin_support_${suffix}_org`,
        approveRequestId: `admin-support-${suffix}-approve`,
        denyRequestId: `admin-support-${suffix}-deny`,
        password: `Aa11!!${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}Bb22!!`,
        pool: new Pool({
            host: process.env.DB_HOST || '127.0.0.1',
            port: Number(process.env.DB_PORT || 8503),
            database: process.env.DB || 'hanasand',
            user: process.env.DB_USER || 'hanasand',
            password: dbPassword,
        }),
    }
}

export async function seedSmoke(context, client) {
    await cleanupSmoke(context)
    await client.signup(context.adminOneId, 'Admin Support Smoke Requester')
    await client.signup(context.adminTwoId, 'Admin Support Smoke Approver')
    await context.pool.query(`
        INSERT INTO organization_members (organization_id, user_id, role, status, invited_by)
        VALUES ($1, $2, 'editor', 'active', $2), ($1, $3, 'editor', 'active', $2)
        ON CONFLICT (organization_id, user_id) DO UPDATE SET role = 'editor', status = 'active'
    `, [hanasandOrganizationId, context.adminOneId, context.adminTwoId])
    await context.pool.query(`
        INSERT INTO organizations (id, name, slug, created_by)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug, updated_at = NOW()
    `, [context.orgId, 'Admin Support Smoke Org', context.orgId, context.adminOneId])
    context.adminOneToken = await client.login(context.adminOneId)
    context.adminTwoToken = await client.login(context.adminTwoId)
}

export async function cleanupSmoke(context) {
    const { pool, approveRequestId, denyRequestId, adminOneId, adminTwoId, orgId } = context
    await pool.query('DELETE FROM admin_audit_events WHERE request_id = ANY($1::text[]) OR actor_id = ANY($2::text[])', [[approveRequestId, denyRequestId], [adminOneId, adminTwoId]]).catch(() => {})
    await pool.query('DELETE FROM admin_access_recovery_approvals WHERE request_id = ANY($1::text[])', [[approveRequestId, denyRequestId]]).catch(() => {})
    await pool.query('DELETE FROM organization_invites WHERE organization_id = $1', [orgId]).catch(() => {})
    await pool.query('DELETE FROM organization_members WHERE organization_id = $1 OR user_id = ANY($2::text[])', [orgId, [adminOneId, adminTwoId]]).catch(() => {})
    await pool.query('DELETE FROM organizations WHERE id = $1', [orgId]).catch(() => {})
    await pool.query('DELETE FROM tokens WHERE id = ANY($1::text[])', [[adminOneId, adminTwoId]]).catch(() => {})
    await pool.query('DELETE FROM users WHERE id = ANY($1::text[])', [[adminOneId, adminTwoId]]).catch(() => {})
}
