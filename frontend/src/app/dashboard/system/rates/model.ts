export const scopeOrder: RateLimitScope[] = ['anonymous', 'authenticated', 'internal']

export const periodFields: Array<{ key: keyof ApiKeyPeriodLimits, label: string }> = [
    { key: 'perSecond', label: 'Per second' },
    { key: 'perMinute', label: 'Per minute' },
    { key: 'perHour', label: 'Per hour' },
    { key: 'perDay', label: 'Per day' },
]

export const fallbackTierPresets: ApiKeyTierDefinition[] = [
    {
        id: 'starter',
        label: 'Starter',
        description: 'Low-volume external integrations.',
        defaultLimits: { perSecond: 2, perMinute: 60, perHour: 1_000, perDay: 10_000 },
    },
    {
        id: 'growth',
        label: 'Growth',
        description: 'Steady third-party traffic with moderate burst room.',
        defaultLimits: { perSecond: 8, perMinute: 240, perHour: 6_000, perDay: 60_000 },
    },
    {
        id: 'business',
        label: 'Business',
        description: 'Higher-throughput production integrations.',
        defaultLimits: { perSecond: 20, perMinute: 600, perHour: 24_000, perDay: 250_000 },
    },
    {
        id: 'internal',
        label: 'Operations',
        description: 'Trusted service automations and operations.',
        defaultLimits: { perSecond: 60, perMinute: 3_000, perHour: 120_000, perDay: 1_000_000 },
    },
    {
        id: 'custom',
        label: 'Custom',
        description: 'Manually tuned per-endpoint limits.',
        defaultLimits: { perSecond: 5, perMinute: 60, perHour: 1_000, perDay: 10_000 },
    },
]

export const fallbackSettings: RateLimitSettings = {
    enabled: true,
    defaults: {
        anonymous: { windowMs: 60_000, maxRequests: 90 },
        authenticated: { windowMs: 60_000, maxRequests: 1_800 },
        internal: { windowMs: 60_000, maxRequests: 6_000 },
    },
    overrides: [],
    updatedAt: null,
    updatedBy: null,
}

export type DraftApiKey = {
    ownerId: string
    name: string
    tier: string
    description: string
    enabled: boolean
    expiresAt: string
    scopes: ApiKeyScopeRule[]
}

export const emptyDraft: DraftApiKey = {
    ownerId: '',
    name: '',
    tier: 'starter',
    description: '',
    enabled: true,
    expiresAt: '',
    scopes: [],
}

export type OwnerUserOption = {
    id: string
    name: string
    email?: string
    organization?: string
    organizationIds?: string
    role?: string
    active?: boolean
}

export function validateScopeSet(scopes: ApiKeyScopeRule[]) {
    if (!scopes.length) {
        return { valid: false, message: 'Add at least one route before creating or saving this key.' }
    }

    const seen = new Set<string>()
    for (const scope of scopes) {
        const key = `${scope.method}:${scope.route}`
        if (seen.has(key)) {
            return {
                valid: false,
                message: `This route is listed more than once: ${scope.method} ${scope.route}. Remove or change one before saving.`,
            }
        }
        seen.add(key)
    }

    return { valid: true, message: '' }
}

export function validateKeyFields(input: Pick<DraftApiKey, 'ownerId' | 'name' | 'tier' | 'description' | 'expiresAt'>) {
    const missing = [
        [input.ownerId, 'Choose an owner'],
        [input.name, 'Name the key'],
        [input.tier, 'Choose a tier'],
        [input.expiresAt, 'Pick an expiry date'],
        [input.description, 'Add a description'],
    ].find(([value]) => !String(value).trim())

    return missing ? { valid: false, message: String(missing[1]) } : { valid: true, message: '' }
}

export function validateOverrideSet(overrides: RateLimitOverride[]) {
    const seen = new Set<string>()
    for (const override of overrides) {
        if (!override.route.startsWith('/api')) {
            return {
                valid: false,
                message: `Override routes must stay under /api. Fix ${override.method} ${override.route} before saving.`,
            }
        }

        const key = `${override.scope}:${override.method}:${override.route}`
        if (seen.has(key)) {
            return {
                valid: false,
                message: `Duplicate override detected for ${override.scope} ${override.method} ${override.route}. Remove or change one of them before saving.`,
            }
        }
        seen.add(key)
    }

    return { valid: true, message: '' }
}

export function createPresetLimits(tier: string, tierPresetMap: Record<string, ApiKeyTierDefinition>): ApiKeyPeriodLimits {
    const preset = tierPresetMap[tier] || tierPresetMap.custom || fallbackTierPresets[fallbackTierPresets.length - 1]
    return {
        perSecond: preset.defaultLimits.perSecond,
        perMinute: preset.defaultLimits.perMinute,
        perHour: preset.defaultLimits.perHour,
        perDay: preset.defaultLimits.perDay,
    }
}

export function isoToDateInput(value: string) {
    return value && !Number.isNaN(Date.parse(value)) ? value.slice(0, 10) : ''
}

export function dateInputToIso(value: string) {
    return value ? `${value}T23:59:59.999Z` : ''
}

export function normalizeOwnerUser(value: unknown): OwnerUserOption | null {
    if (!value || typeof value !== 'object') return null
    const entry = value as Record<string, unknown>
    const id = stringValue(entry.id)
    if (!id) return null
    const name = stringValue(entry.name) || stringValue(entry.displayName) || stringValue(entry.display_name) || id
    return {
        id,
        name,
        email: stringValue(entry.email),
        organization: stringValue(entry.organization) || stringValue(entry.organizationName) || stringValue(entry.organization_name),
        organizationIds: stringValue(entry.organizationIds) || stringValue(entry.organization_ids),
        role: stringValue(entry.role) || stringValue(entry.highest_role_name) || stringValue(entry.highestRoleName),
        active: typeof entry.active === 'boolean' ? entry.active : undefined,
    }
}

function stringValue(value: unknown) {
    return typeof value === 'string' ? value.trim() : ''
}

export function formatOwnerUser(user: OwnerUserOption) {
    return [user.name, user.email || user.organization || user.id].filter(Boolean).join(' · ')
}

export function ownerUserMeta(user: OwnerUserOption) {
    return [user.email, user.organization, user.organizationIds, user.role, user.active === false ? 'Inactive' : null, user.id]
        .filter(Boolean).join(' · ')
}

export function ownerUserSearchText(user: OwnerUserOption) {
    return [user.id, user.name, user.email, user.organization, user.organizationIds, user.role]
        .filter(Boolean).join(' ').toLowerCase()
}

export function sortOwnerUsers(first: OwnerUserOption, second: OwnerUserOption) {
    if (first.active === false && second.active !== false) return 1
    if (first.active !== false && second.active === false) return -1
    return (first.name || first.id).localeCompare(second.name || second.id)
}
