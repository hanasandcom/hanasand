import bcrypt from 'bcrypt'
import run from '#db'
import login from '#utils/auth/login.ts'
import { syncMailPasswordForUser } from '#utils/mail/accounts.ts'

type UpdateUserPasswordOptions = {
    userId: string
    password: string
    ip: string
    userAgent: string
    devicePublicJwk?: unknown
}

export default async function updateUserPassword({ userId, password, ip, userAgent, devicePublicJwk }: UpdateUserPasswordOptions) {
    const hashedPassword = await bcrypt.hash(password, 10)
    const updated = await run(
        `UPDATE users
        SET password = $2
        WHERE id = $1
        RETURNING id`,
        [userId, hashedPassword]
    )

    if (!updated.rowCount) return { userFound: false as const }

    const userResult = await run('SELECT name FROM users WHERE id = $1', [userId])
    const displayName = String(userResult.rows[0]?.name || userId)
    await syncMailPasswordForUser(userId, displayName, password)

    return { userFound: true as const, session: await login({ id: userId, ip, userAgent, devicePublicJwk }) }
}
