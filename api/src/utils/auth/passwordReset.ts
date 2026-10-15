import run from '#db'

export async function consumePendingPasswordResetCodes(userId: string, query: typeof run = run) {
    await query('UPDATE password_reset_codes SET consumed_at = NOW() WHERE user_id = $1 AND consumed_at IS NULL', [userId])
}
