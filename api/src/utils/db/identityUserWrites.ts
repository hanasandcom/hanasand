import run from '#db'
import type { IdentityQuery } from './identityQueryTypes.ts'

export async function insertIdentityUserIfAbsent(input: {
    id: string
    name: string
    password: string
    avatar: string
    username?: string | null
    email?: string | null
    emailVerifiedAt?: Date | string | null
}, query: IdentityQuery = run) {
    try {
        await query(`
            INSERT INTO users (id, name, password, avatar, username, email, email_verified_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [input.id, input.name, input.password, input.avatar, input.username ?? null, input.email ?? null, input.emailVerifiedAt ?? null])
        return true
    } catch (error) {
        if ((error as { code?: string })?.code === '23505') return false
        throw error
    }
}

export async function incrementIdentityLoginAttempt(userId: string, ip: string, query: IdentityQuery = run) {
    const update = async () => query(`
        UPDATE attempts
           SET attempts = attempts + 1, ip = $2, timestamp = NOW()
         WHERE id = $1
        RETURNING id
    `, [userId, ip])
    const updated = await update()
    if (updated.rowCount) return
    try {
        await query('INSERT INTO attempts (id, attempts, ip) VALUES ($1, 1, $2)', [userId, ip])
    } catch (error) {
        if ((error as { code?: string })?.code !== '23505') throw error
        const retried = await update()
        if (!retried.rowCount) throw error
    }
}

export async function upsertIdentityPasskey(input: {
    credentialId: string
    userId: string
    publicKeyCose: string
    signCount: number
    algorithm: number
    aaguid: string
    label: string
}, query: IdentityQuery = run) {
    const values = [input.credentialId, input.userId, input.publicKeyCose, input.signCount,
        input.algorithm, input.aaguid, input.label]
    const update = async () => query(`
        UPDATE user_passkeys
           SET user_id = $2, public_key_cose = $3, sign_count = $4,
               alg = $5, aaguid = $6, label = $7
         WHERE credential_id = $1
        RETURNING credential_id
    `, values)
    const updated = await update()
    if (updated.rowCount) return
    try {
        await query(`
            INSERT INTO user_passkeys (credential_id, user_id, public_key_cose, sign_count, alg, aaguid, label, last_used_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NULL)
        `, values)
    } catch (error) {
        if ((error as { code?: string })?.code !== '23505') throw error
        const retried = await update()
        if (!retried.rowCount) throw error
    }
}
