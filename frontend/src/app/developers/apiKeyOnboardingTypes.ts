export type Organization = { id: string, name: string, role?: string }

export type ApiKey = {
    id: string
    organizationId: string | null
    name: string
    keyPrefix: string
    enabled: boolean
    expiresAt: string | null
    lastUsedAt: string | null
    scopes: Array<{ method: string, route: string }>
}
