import run from '#db'
import { orgId, otherUserId, ownerId, suffix } from './state.ts'

export async function seedOrganization() {
    await run(`
        INSERT INTO users (id, name, password, avatar, active)
        VALUES
            ($1, 'DWM Webhook Smoke Owner', crypt($3, gen_salt('bf')), '', TRUE),
            ($2, 'DWM Webhook Smoke Member', crypt($3, gen_salt('bf')), '', TRUE)
        ON CONFLICT (id) DO NOTHING
    `, [ownerId, otherUserId, `Smoke-${suffix}-Aa11!!`])
    await run(`
        INSERT INTO organizations (id, name, slug, created_by)
        VALUES ($1, 'DWM Webhook Smoke Org', $2, $3)
        ON CONFLICT (id) DO NOTHING
    `, [orgId, orgId, ownerId])
    await run(`
        INSERT INTO organization_members (organization_id, user_id, role, status, invited_by)
        VALUES
            ($1, $2, 'owner', 'active', $2),
            ($1, $3, 'member', 'active', $2)
        ON CONFLICT (organization_id, user_id)
        DO UPDATE SET status = 'active'
    `, [orgId, ownerId, otherUserId])
}

export async function cleanup() {
    await run('DELETE FROM dwm_webhook_audit_events WHERE owner_id = $1 OR owner_id = $2 OR org_id = $3', [ownerId, otherUserId, orgId]).catch(() => {})
    await run('DELETE FROM dwm_webhook_deliveries WHERE owner_id = $1 OR owner_id = $2 OR org_id = $3', [ownerId, otherUserId, orgId]).catch(() => {})
    await run('DELETE FROM dwm_webhook_destinations WHERE owner_id = $1 OR owner_id = $2 OR org_id = $3', [ownerId, otherUserId, orgId]).catch(() => {})
    await run('DELETE FROM organization_members WHERE organization_id = $1 OR user_id = $2 OR user_id = $3', [orgId, ownerId, otherUserId]).catch(() => {})
    await run('DELETE FROM organization_invites WHERE organization_id = $1', [orgId]).catch(() => {})
    await run('DELETE FROM organization_watchlist_items WHERE organization_id = $1', [orgId]).catch(() => {})
    await run('DELETE FROM organizations WHERE id = $1', [orgId]).catch(() => {})
    await run('DELETE FROM tokens WHERE id = $1 OR id = $2', [ownerId, otherUserId]).catch(() => {})
    await run('DELETE FROM users WHERE id = $1 OR id = $2', [ownerId, otherUserId]).catch(() => {})
}
