import { identityQueryOnce, withIdentityAdvisoryLock, withIdentityTransaction } from '#db'
import { invalidateProfileSshKeysResponseCache } from '#utils/profileSshKeyCache.ts'
import { invalidateProfileSshKeyUsageIndex } from '#utils/sshKeyUsage.ts'
import { applyManagedHostSshKeys, normalizeHostPublicKey } from '#utils/hostSsh.ts'

type UserCertificate = { id: number, public_key: string }

/** Reconcile the remaining OVH keys and remove a user's personal SSH credentials. */
export async function purgeUserSshKeys(userId: string) {
    return withIdentityAdvisoryLock('profile-ssh-keys-sync', async () => {
        const userKeys = (await identityQueryOnce(`
            SELECT certificate.id, certificate.public_key
            FROM certificates certificate
            JOIN user_certificates assignment ON assignment.certificate_id = certificate.id
            WHERE assignment.user_id = $1
            ORDER BY certificate.id
        `, [userId])).rows as UserCertificate[]
        if (!userKeys.length) return 0

        const activeKeys = (await identityQueryOnce(`
            SELECT DISTINCT certificate.public_key
            FROM certificates certificate
            JOIN user_certificates assignment ON assignment.certificate_id = certificate.id
            JOIN users active_user ON active_user.id = assignment.user_id
            WHERE active_user.active IS TRUE
              AND active_user.deletion_scheduled_at IS NULL
            ORDER BY certificate.public_key
        `)).rows.map(row => String(row.public_key))
        const activeFingerprints = new Set(activeKeys.map(key => normalizeHostPublicKey(key)?.fingerprint).filter((value): value is string => Boolean(value)))
        const revoked = userKeys.map(key => key.public_key).filter(key => {
            const fingerprint = normalizeHostPublicKey(key)?.fingerprint
            return fingerprint && !activeFingerprints.has(fingerprint)
        })

        // If either host cannot remove a key, leave Identity relationships in
        // place so the next account-deletion pass can retry the reconciliation.
        await applyManagedHostSshKeys(activeKeys, revoked)
        await withIdentityTransaction(async query => {
            await query('DELETE FROM user_certificates WHERE user_id = $1', [userId])
            await query(`
                DELETE FROM certificates
                WHERE id = ANY($1::int[])
                  AND NOT EXISTS (SELECT 1 FROM user_certificates WHERE certificate_id = certificates.id)
            `, [userKeys.map(key => String(key.id))])
        })
        invalidateProfileSshKeysResponseCache(userId)
        invalidateProfileSshKeyUsageIndex()
        return userKeys.length
    })
}
