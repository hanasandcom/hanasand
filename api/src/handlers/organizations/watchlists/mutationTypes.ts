import type { WatchlistInput } from '#utils/organizations.ts'

export type OrganizationParams = { id: string }
export type WatchlistParams = { organizationId: string; itemId: string }
export type WatchlistMutationBody = WatchlistInput & {
    requestId?: unknown
    request_id?: unknown
}
