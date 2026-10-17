import crypto from 'crypto'
import pg from 'pg'

const hanasandOrganizationId = '3e735e7b-4d7f-444d-9806-231fa26cfcec'
const { Pool } = pg

export function createSmokeFixture() {
    const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 10)
    const ids = {
        adminId: `pw_${suffix}_a`,
        targetId: `pw_${suffix}_t`,
        inactiveTargetId: `pw_${suffix}_i`,
        nonAdminId: `pw_${suffix}_u`,
    }
    const password = `Aa11!!${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}Bb22!!`
    const pool = new Pool({
        host: process.env.DB_HOST || '127.0.0.1',
        port: Number(process.env.DB_PORT || 5432),
        database: process.env.DB || 'hanasand',
        user: process.env.DB_USER || 'hanasand',
        password: process.env.DB_PASSWORD,
    })
    return { suffix, ...ids, password, pool }
}

export async function grantInternalOrganizationAccess({ pool, adminId }) {
    await pool.query(`
        INSERT INTO organization_members (organization_id, user_id, role, status, invited_by)
        VALUES ($1, $2, 'editor', 'active', $2)
        ON CONFLICT (organization_id, user_id) DO UPDATE SET role = 'editor', status = 'active'
    `, [hanasandOrganizationId, adminId])
}

export async function cleanupSmoke({ pool, adminId, targetId, inactiveTargetId, nonAdminId }) {
    const ids = [adminId, targetId, inactiveTargetId, nonAdminId]
    await pool.query('DELETE FROM admin_audit_events WHERE actor_id = ANY($1::text[]) OR target_id = ANY($1::text[])', [ids]).catch(() => {})
    await pool.query('DELETE FROM impersonation_events WHERE actor_id = ANY($1::text[]) OR target_id = ANY($1::text[])', [ids]).catch(() => {})
    await pool.query('DELETE FROM impersonation_sessions WHERE actor_id = ANY($1::text[]) OR target_id = ANY($1::text[])', [ids]).catch(() => {})
    await pool.query('DELETE FROM organization_members WHERE user_id = ANY($1::text[])', [ids]).catch(() => {})
    await pool.query('DELETE FROM tokens WHERE id = ANY($1::text[])', [ids]).catch(() => {})
    await pool.query('DELETE FROM users WHERE id = ANY($1::text[])', [ids]).catch(() => {})
}
