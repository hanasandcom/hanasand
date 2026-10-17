import crypto from 'crypto'
import fs from 'fs'
import pg from 'pg'
import { createApiRequester } from './helpers/apiRequester.mjs'

const hanasandOrganizationId = '3e735e7b-4d7f-444d-9806-231fa26cfcec'
const { Pool } = pg

export function createRateLimitSmokeContext() {
    const insideDocker = fs.existsSync('/.dockerenv')
    const apiBase = process.env.API_BASE || (insideDocker ? 'http://127.0.0.1:8081/api' : 'http://127.0.0.1:8080/api')
    const frontendBase = process.env.FRONTEND_BASE || (insideDocker ? 'http://frontend:3000' : 'http://127.0.0.1:3000')
    const runId = `rate_limit_smoke_${Date.now()}`
    const password = `Aa11!!${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}Bb22!!`
    const pool = new Pool({
        host: process.env.DB_HOST || (insideDocker ? 'hanasand_database' : '127.0.0.1'),
        port: Number(process.env.DB_PORT || (insideDocker ? 5432 : 8503)),
        database: process.env.DB || 'hanasand',
        user: process.env.DB_USER || 'hanasand',
        password: process.env.DB_PASSWORD,
    })
    const context = {
        insideDocker,
        apiBase,
        frontendBase,
        runId,
        password,
        pool,
        token: '',
        issuedSecret: '',
        createdKeyIds: [],
        request: createApiRequester(apiBase),
        expect,
        authHeaders(extra = {}) {
            return { Authorization: `Bearer ${context.token}`, id: runId, ...extra }
        },
        apiKeyHeaders(extra = {}) {
            return { 'x-api-key': context.issuedSecret, ...extra }
        },
        pageRequest,
        cleanup,
        seedAdminUser,
    }

    async function pageRequest(path, cookieHeader) {
        const response = await fetch(`${frontendBase}${path}`, {
            headers: { Cookie: cookieHeader },
            redirect: 'manual',
        })
        return { response, text: await response.text() }
    }

    async function cleanup() {
        for (const keyId of context.createdKeyIds) {
            await pool.query('DELETE FROM api_key_scopes WHERE api_key_id = $1', [keyId]).catch(() => {})
            await pool.query('DELETE FROM api_keys WHERE id = $1', [keyId]).catch(() => {})
        }
        await pool.query('DELETE FROM organization_members WHERE organization_id = $1 AND user_id = $2', [hanasandOrganizationId, runId]).catch(() => {})
        await pool.query('DELETE FROM tokens WHERE id = $1', [runId]).catch(() => {})
        await pool.query('DELETE FROM users WHERE id = $1', [runId]).catch(() => {})
    }

    async function seedAdminUser() {
        const signup = await context.request('/user', {
            method: 'POST',
            body: JSON.stringify({ id: runId, name: 'Rate Limit Smoke', password }),
        })
        expect(signup.response.status === 201, 'Failed to create rate-limit smoke user.', signup.body)
        await pool.query(`
            INSERT INTO organization_members (organization_id, user_id, role, status, invited_by)
            VALUES ($1, $2, 'editor', 'active', $2)
            ON CONFLICT (organization_id, user_id) DO UPDATE SET role = 'editor', status = 'active'
        `, [hanasandOrganizationId, runId])
        const login = await context.request(`/auth/login/${runId}`, {
            method: 'POST',
            body: JSON.stringify({ password }),
        })
        expect(Boolean(login.body?.token), 'Failed to log in rate-limit smoke user.', login.body)
        context.token = login.body.token
        const cookieHeader = [`access_token=${context.token}`, `id=${runId}`].join('; ')
        const dashboard = await pageRequest('/system/rates', cookieHeader)
        expect(dashboard.response.status === 200, 'Rate-limit dashboard page did not render for authenticated admin.', {
            status: dashboard.response.status,
        })
        expect(dashboard.text.includes('Rate limits and API keys'), 'Rate-limit dashboard copy is missing from the rendered page.', dashboard.text.slice(0, 1200))
    }

    return context
}

function expect(condition, message, details) {
    if (!condition) {
        const error = new Error(message)
        if (details !== undefined) error.details = details
        throw error
    }
}
