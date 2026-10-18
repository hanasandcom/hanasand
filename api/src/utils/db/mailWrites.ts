import run from '#db'
import type { IdentityQuery } from './identityQueryTypes.ts'
import { updateThenInsert } from './updateThenInsert.ts'

export async function upsertMailAccount(input: {
    userId: string
    username: string
    address: string
    encryptedPassword: string
    principalId: number | null
}, query: IdentityQuery = run) {
    const update = async () => query(`
        UPDATE mail_accounts
           SET mail_username = $2,
               mail_address = $3,
               mail_password_encrypted = $4,
               principal_id = $5,
               updated_at = NOW()
         WHERE user_id = $1
        RETURNING user_id
    `, [input.userId, input.username, input.address, input.encryptedPassword, input.principalId])

    await updateThenInsert(update, () => query(`
            INSERT INTO mail_accounts (user_id, mail_username, mail_address, mail_password_encrypted, principal_id)
            VALUES ($1, $2, $3, $4, $5)
        `, [input.userId, input.username, input.address, input.encryptedPassword, input.principalId]))
}
