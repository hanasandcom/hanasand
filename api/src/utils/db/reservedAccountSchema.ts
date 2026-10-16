import run from '#db'
import { reservedUsernames } from '#utils/auth/reservedUsernames.ts'

export default async function ensureReservedAccountSchema() {
    const ownerUserIds = (process.env.HANASAND_OWNER_USER_IDS || 'eirikhanasand').split(',').map(id => id.trim().toLowerCase()).filter(Boolean)
    const obsoleteProbeUserNames = [
        'Browser Proof',
        'Browser Proof Analyst',
        'Codex Auth Test',
        'Codex Org Probe',
        'Codex Render Probe',
        'Codex Visual Probe',
    ].map(name => name.toLowerCase())
    await run(`
            INSERT INTO users (id, name, password, avatar, active, reserved)
            SELECT id, name, crypt(gen_random_uuid()::text, gen_salt('bf')), '', FALSE, TRUE
            FROM unnest($1::text[], $2::text[]) AS reserved(id, name)
            WHERE NOT EXISTS (SELECT 1 FROM users existing WHERE existing.id = reserved.id)
        `, [
        reservedUsernames,
        reservedUsernames.map(username => `${username} reserved account`),
    ])
    await run('UPDATE users SET reserved = TRUE WHERE lower(id) = ANY($1::text[])', [reservedUsernames])
    await run(`
            UPDATE users
            SET active = TRUE,
                deactivated_at = NULL,
                deactivated_by = NULL,
                deletion_requested_at = NULL,
                deletion_scheduled_at = NULL,
                name = CASE
                    WHEN name = id || ' reserved account' THEN 'Eirik Hanasand'
                    ELSE name
                END
            WHERE lower(id) = ANY($1::text[])
        `, [ownerUserIds])
    await run(`
            DELETE FROM users
            WHERE lower(name) = ANY($1::text[])
              AND NOT (lower(id) = ANY($2::text[]))
        `, [obsoleteProbeUserNames, ownerUserIds])
}
