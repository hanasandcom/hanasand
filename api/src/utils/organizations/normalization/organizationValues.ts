import type { OrganizationDefaultWebhookPolicy, OrganizationLifecycleStatus } from '../types.ts'
import type { OrganizationAlertVisibilityPolicy } from '../../organizationVisibility.ts'
import { cleanText, looksSensitive, slugFor } from './text.ts'

const defaultWebhookPolicies = new Set<OrganizationDefaultWebhookPolicy>(['active_destinations', 'manual_selection', 'disabled'])
const alertVisibilityPolicies = new Set<OrganizationAlertVisibilityPolicy>(['members', 'admins', 'owners'])
const organizationLifecycleStatuses = new Set<OrganizationLifecycleStatus>(['active', 'archived', 'deleted'])

export function normalizeSettingsName(value: unknown) {
    const name = cleanText(value)
    if (!name) {
        throw new Error('Organization name is required.')
    }

    if (name.length > 120) {
        throw new Error('Organization name must be 120 characters or fewer.')
    }

    return name
}

export function normalizeSettingsSlug(value: unknown) {
    const slug = slugFor(cleanText(value))
    if (!slug) {
        throw new Error('Organization slug is required.')
    }

    if (slug.length > 80) {
        throw new Error('Organization slug must be 80 characters or fewer.')
    }

    return slug
}

export function normalizeDefaultWebhookPolicy(value: unknown) {
    if (value === undefined) return undefined
    const policy = cleanText(value).toLowerCase()
    if (!defaultWebhookPolicies.has(policy as OrganizationDefaultWebhookPolicy)) {
        throw new Error('Default webhook policy must be active_destinations, manual_selection, or disabled.')
    }

    return policy as OrganizationDefaultWebhookPolicy
}

export function normalizeAlertVisibilityPolicy(value: unknown) {
    if (value === undefined) return undefined
    const policy = cleanText(value).toLowerCase()
    if (!alertVisibilityPolicies.has(policy as OrganizationAlertVisibilityPolicy)) {
        throw new Error('Alert visibility policy must be members, admins, or owners.')
    }

    return policy as OrganizationAlertVisibilityPolicy
}

export function normalizeOrganizationLifecycleStatus(value: unknown) {
    if (value === undefined) return undefined
    const status = cleanText(value).toLowerCase()
    if (!organizationLifecycleStatuses.has(status as OrganizationLifecycleStatus)) {
        throw new Error('Organization lifecycle status must be active, archived, or deleted.')
    }

    return status as OrganizationLifecycleStatus
}

export function normalizeOrganizationStatus(value: unknown): OrganizationLifecycleStatus {
    const status = cleanText(value).toLowerCase()
    return organizationLifecycleStatuses.has(status as OrganizationLifecycleStatus)
        ? status as OrganizationLifecycleStatus
        : 'active'
}

export function normalizeRetentionDays(value: unknown) {
    if (value === undefined) return undefined
    const days = typeof value === 'number' ? value : Number(cleanText(value))
    if (!Number.isInteger(days) || days < 30 || days > 2555) {
        throw new Error('Retention days must be an integer between 30 and 2555.')
    }

    return days
}

export function normalizeAuditSafeMetadata(value: unknown) {
    if (value === undefined) return undefined
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Audit-safe metadata must be an object.')
    }

    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length > 20) {
        throw new Error('Audit-safe metadata can contain at most 20 keys.')
    }

    return Object.fromEntries(entries.map(([rawKey, rawValue]) => {
        const key = rawKey.trim().replace(/[^a-zA-Z0-9_.-]+/g, '_').slice(0, 64)
        if (!key) {
            throw new Error('Audit-safe metadata keys must contain letters or numbers.')
        }

        if (rawValue === null || typeof rawValue === 'boolean' || typeof rawValue === 'number') {
            return [key, rawValue]
        }

        if (typeof rawValue === 'string') {
            const value = cleanText(rawValue).slice(0, 240)
            if (looksSensitive(value)) {
                throw new Error('Audit-safe metadata cannot contain emails, URLs, or secrets.')
            }

            return [key, value]
        }

        throw new Error('Audit-safe metadata values must be strings, numbers, booleans, or null.')
    }))
}
