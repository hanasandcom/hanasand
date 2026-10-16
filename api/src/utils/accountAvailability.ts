export type AccountAvailabilityFields = {
    active?: unknown
    deactivated_at?: unknown
    deletion_scheduled_at?: unknown
}

export function isAccountUnavailable(account: AccountAvailabilityFields): boolean {
    return account.active === false || Boolean(account.deactivated_at || account.deletion_scheduled_at)
}

export function isAccountAvailable(account: AccountAvailabilityFields): boolean {
    return !isAccountUnavailable(account)
}
