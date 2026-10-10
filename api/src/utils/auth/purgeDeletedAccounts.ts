import { purgeDeletedAccounts as purgeIdentityAccounts } from '#utils/auth/session.ts'

export default async function purgeDeletedAccounts() {
    return purgeIdentityAccounts()
}
