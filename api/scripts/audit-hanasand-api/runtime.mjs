import crypto from 'crypto'
import pg from 'pg'
import { createRequester } from './request.mjs'

const hanasandOrganizationId = '3e735e7b-4d7f-444d-9806-231fa26cfcec'

export function createAuditRuntime() {
    const apiBase = process.env.API_BASE || 'http://127.0.0.1:8080/api'
    const vmToken = process.env.VM_API_TOKEN || ''
    const runId = `audit_${Date.now()}`
    const password = process.env.AUDIT_PASSWORD
        || `Aa11!!${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}Bb22!!`
    const pool = createPool()
    const runtime = {
        apiBase,
        runId,
        password,
        vmToken,
        pool,
        results: [],
        token: '',
        expectObject,
        expectArray,
    }

    runtime.request = createRequester(runtime)
    runtime.authHeaders = createAuthHeaders(runtime)
    runtime.vmHeaders = createVmHeaders(runtime)
    runtime.grantHanasandEditorAccess = () => grantHanasandEditorAccess(runtime)
    runtime.cleanup = () => cleanup(runtime)
    return runtime
}

function createPool() {
    const { Pool } = pg
    return new Pool({
        host: process.env.DB_HOST || '127.0.0.1',
        port: Number(process.env.DB_PORT || 5432),
        database: process.env.DB || 'hanasand',
        user: process.env.DB_USER || 'hanasand',
        password: process.env.DB_PASSWORD,
    })
}

function expectObject(body) {
    return body && typeof body === 'object' && !Array.isArray(body)
}

function expectArray(body) {
    return Array.isArray(body)
}

function createAuthHeaders(runtime) {
    return (extra = {}) => ({
        Authorization: `Bearer ${runtime.token}`,
        id: runtime.runId,
        ...extra,
    })
}

function createVmHeaders(runtime) {
    return (extra = {}) => ({
        Authorization: `Bearer ${encodeURIComponent(runtime.vmToken)}`,
        ...extra,
    })
}

async function grantHanasandEditorAccess({ pool, runId }) {
    await pool.query(`
        INSERT INTO organization_members (organization_id, user_id, role, status, invited_by)
        VALUES ($1, $2, 'editor', 'active', $2)
        ON CONFLICT (organization_id, user_id) DO UPDATE SET role = 'editor', status = 'active'
    `, [hanasandOrganizationId, runId])
}

async function cleanup({ pool, runId }) {
    await pool.query('DELETE FROM user_certificates WHERE user_id = $1', [runId]).catch(() => {})
    await pool.query('DELETE FROM certificates WHERE owner = $1 OR created_by = $1', [runId]).catch(() => {})
    await pool.query('DELETE FROM vm_metrics WHERE name = $1', [`vm-${runId}`]).catch(() => {})
    await pool.query('DELETE FROM vm_details WHERE name = $1', [`vm-${runId}`]).catch(() => {})
    await pool.query('DELETE FROM vm_shutdown WHERE name = $1', [`vm-${runId}`]).catch(() => {})
    await pool.query('DELETE FROM vms WHERE name = $1', [`vm-${runId}`]).catch(() => {})
    await pool.query('DELETE FROM organization_members WHERE organization_id = $1 AND user_id = $2', [hanasandOrganizationId, runId]).catch(() => {})
    await pool.query('DELETE FROM events WHERE ingestion_id=\'logs\' AND normalized->\'metadata\'->>\'runId\' = $1', [runId]).catch(() => {})
    await pool.query('DELETE FROM tokens WHERE id = $1', [runId]).catch(() => {})
    await pool.query('DELETE FROM users WHERE id = $1', [runId]).catch(() => {})
}
