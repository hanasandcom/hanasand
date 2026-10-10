import { cleanupExpiredSessions } from '#utils/auth/session.ts'

export default async function invalidateOldAttempts() {
    await cleanupExpiredSessions()
}
