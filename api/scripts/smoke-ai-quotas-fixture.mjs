import crypto from 'crypto'
import pg from 'pg'
import { createApiRequester } from './helpers/apiRequester.mjs'

const { Pool } = pg

export function createQuotaSmokeFixture(dbPassword) {
    const apiBase = process.env.API_BASE || 'http://127.0.0.1:8080/api'
    const dbHost = process.env.DB_HOST || '127.0.0.1'
    const dbPort = Number(process.env.DB_PORT || 5432)
    const dbName = process.env.DB || 'hanasand'
    const dbUser = process.env.DB_USER || 'hanasand'
    const runId = `quota_smoke_${Date.now()}`
    const password = `Aa11!!${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}Bb22!!`
    const vmName = `vm-quota-${Date.now()}`
    const conversationId = `conversation-${Date.now()}`
    const secondConversationId = `conversation-quota-second-${Date.now()}`
    const repositoryId = `repo-${Date.now()}`
    const collaboratorIds = Array.from({ length: 6 }, (_, index) => `${runId}_collab_${index + 1}`)
    const pool = new Pool({ host: dbHost, port: dbPort, database: dbName, user: dbUser, password: dbPassword })
    const request = createApiRequester(apiBase)
    let token = ''

    return {
        runId,
        password,
        vmName,
        conversationId,
        secondConversationId,
        repositoryId,
        collaboratorIds,
        pool,
        request,
        setToken(value) { token = value },
        authHeaders(extra = {}) {
            return { Authorization: `Bearer ${token}`, id: runId, ...extra }
        },
    }
}

export function expect(condition, message, details) {
    if (!condition) {
        const error = new Error(message)
        if (details !== undefined) error.details = details
        throw error
    }
}

export async function cleanup({ pool, conversationId, secondConversationId, repositoryId, vmName, runId, collaboratorIds }) {
    const conversationIds = [conversationId, secondConversationId]
    await pool.query('DELETE FROM ai_conversation_collaborators WHERE conversation_id = ANY($1::text[])', [conversationIds]).catch(() => {})
    await pool.query('DELETE FROM ai_deployments WHERE conversation_id = ANY($1::text[])', [conversationIds]).catch(() => {})
    await pool.query('DELETE FROM ai_messages WHERE conversation_id = ANY($1::text[])', [conversationIds]).catch(() => {})
    await pool.query('DELETE FROM ai_conversations WHERE id = ANY($1::text[])', [conversationIds]).catch(() => {})
    await pool.query('DELETE FROM ai_imported_repository_files WHERE repository_id = $1', [repositoryId]).catch(() => {})
    await pool.query('DELETE FROM ai_imported_repositories WHERE id = $1', [repositoryId]).catch(() => {})
    await pool.query('DELETE FROM vm_shutdown WHERE name = $1', [vmName]).catch(() => {})
    await pool.query('DELETE FROM vm_metrics WHERE name = $1', [vmName]).catch(() => {})
    await pool.query('DELETE FROM vm_details WHERE name = $1', [vmName]).catch(() => {})
    await pool.query('DELETE FROM vms WHERE name = $1', [vmName]).catch(() => {})
    await pool.query('DELETE FROM tokens WHERE id = $1', [runId]).catch(() => {})
    await pool.query('DELETE FROM users WHERE id = $1', [runId]).catch(() => {})
    await pool.query('DELETE FROM tokens WHERE id = ANY($1::text[])', [collaboratorIds]).catch(() => {})
    await pool.query('DELETE FROM users WHERE id = ANY($1::text[])', [collaboratorIds]).catch(() => {})
}

export async function seedBase(fixture) {
    const { request, runId, password, vmName, repositoryId, conversationId, secondConversationId, collaboratorIds, pool } = fixture
    const signup = await request('/user', {
        method: 'POST',
        body: JSON.stringify({ id: runId, name: 'Quota Smoke', password }),
    })
    expect(signup.response.status === 201, 'Failed to create quota smoke user.', signup.body)

    const login = await request(`/auth/login/${runId}`, {
        method: 'POST',
        body: JSON.stringify({ password }),
    })
    expect(Boolean(login.body?.token), 'Failed to log in quota smoke user.', login.body)
    fixture.setToken(login.body.token)

    await pool.query(`
        INSERT INTO vms (name, owner, created_by, access_users)
        VALUES ($1, $2, $2, $3::jsonb)
    `, [vmName, runId, JSON.stringify([runId])])
    await pool.query(`
        INSERT INTO vm_details (
            name, status, type, architecture, created, last_used,
            config_architecture, config_image_architecture, config_image_description, config_image_label,
            config_image_os, config_image_release, config_image_serial, config_image_type, config_image_version,
            limits_cpu, limits_memory, volatile_base_image, volatile_cloud_init_instance_id, volatile_eth0_hwaddr,
            volatile_last_state_power, volatile_uuid, volatile_uuid_generation, volatile_vsock_id,
            device_eth0_ipv4_address, device_eth0_name, device_eth0_network, device_eth0_type,
            description, last_checked
        )
        VALUES (
            $1, 'running', 'container', 'x86_64', NOW(), NOW(),
            'x86_64', 'x86_64', 'Ubuntu quota VM', 'ubuntu-25.10',
            'ubuntu', '25.10', '20260425', 'squashfs', '25.10',
            '2', '2GiB', 'base-image', 'cloud-init-quota', '00:16:3e:00:00:02',
            'RUNNING', 'uuid-quota', 'uuid-generation-quota', '1002',
            '10.55.0.10', 'eth0', 'lxdbr0', 'nic',
            'Quota VM target', NOW()
        )
    `, [vmName])
    await pool.query(`
        INSERT INTO ai_imported_repositories (
            id, owner_id, name, full_name, branch, default_branch, source_path, source_url,
            auth_mode, sync_status, stack_type, stack_reason, imported_at
        )
        VALUES (
            $1, $2, 'quota-smoke', 'example/quota-smoke', 'main', 'main', '', 'https://github.com/example/quota-smoke',
            'public', 'ready', 'nextjs_docker', 'Pre-seeded supported stack for quota smoke.', NOW()
        )
    `, [repositoryId, runId])
    await pool.query(`
        INSERT INTO ai_conversations (
            id, owner_id, title, workspace_kind, workspace_id, workspace_meta, created_at, updated_at
        )
        VALUES ($1, $2, 'Quota smoke', 'repo', $3, $4::jsonb, NOW(), NOW())
    `, [conversationId, runId, repositoryId, JSON.stringify({ repositoryId })])
    await pool.query(`
        INSERT INTO ai_conversations (
            id, owner_id, title, workspace_kind, workspace_id, workspace_meta, created_at, updated_at
        )
        VALUES ($1, $2, 'Quota smoke second deployment', 'repo', $3, $4::jsonb, NOW(), NOW())
    `, [secondConversationId, runId, repositoryId, JSON.stringify({ repositoryId })])

    for (const collaboratorId of collaboratorIds) {
        await request('/user', {
            method: 'POST',
            body: JSON.stringify({ id: collaboratorId, name: collaboratorId, password }),
        })
    }
}
