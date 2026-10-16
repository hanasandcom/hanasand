import type { OrganizationPage } from '@/utils/organizations/pages'
import type { OrgBundle } from '../types/bundle'
import type { OrganizationApiKey, OrganizationInvite, OrganizationMember, OrganizationPrivacyState, OrganizationSummary } from '../types/organization'
import type { ScopedAlert, ScopedCase } from '../types/activity'
import type { AlertTerm, WatchlistItem } from '../types/watchlists'
import type { WebhookDestination } from '../types/delivery'
import { arrayValue, cleanString, normalizeAlertGenerationRecords, objectValue } from './labels'
import { normalizedDeliveryRows } from './deliveries'

export const initialOrganizationBundle: OrgBundle = {
    settings: null, privacy: null, members: [], invites: [], watchlists: [], alertTerms: [],
    alerts: [], cases: [], webhooks: [], deliveries: [], alertCaseVisibility: null,
    apiKeys: [], loadErrors: [],
}

export const organizationBundleKeysByPage: Record<OrganizationPage, readonly string[]> = {
    overview: ['settings', 'members', 'invites', 'watchlists', 'alertTerms', 'events', 'cases', 'webhooks', 'deliveries'],
    settings: ['settings'], team: ['members', 'invites'],
    watchlists: ['members', 'watchlists', 'alertTerms', 'events', 'webhooks', 'deliveries'],
    'api-keys': ['apiKeys'], privacy: ['settings', 'privacy'],
    events: ['alertTerms', 'events', 'cases', 'deliveries', 'members', 'watchlists', 'webhooks', 'alertCaseVisibility'],
    activity: ['settings', 'members', 'invites', 'watchlists', 'alertTerms', 'events', 'cases', 'webhooks', 'deliveries'],
}

export function mergeOrganizationPayload(bundle: OrgBundle, key: string, payload: Record<string, unknown>, organization?: OrganizationSummary) {
    if (key === 'settings') bundle.settings = {
        ...objectValue(payload.settings),
        name: cleanString(objectValue(payload.organization)?.name) || organization?.name || '',
        slug: cleanString(objectValue(payload.organization)?.slug) || organization?.slug || '',
    }
    if (key === 'apiKeys') bundle.apiKeys = arrayValue<OrganizationApiKey>(payload.apiKeys)
    if (key === 'privacy') bundle.privacy = payload as OrganizationPrivacyState
    if (key === 'members') bundle.members = arrayValue<OrganizationMember>(payload.members)
    if (key === 'invites') bundle.invites = arrayValue<OrganizationInvite>(payload.invites)
    if (key === 'watchlists') bundle.watchlists = normalizeAlertGenerationRecords<WatchlistItem>(payload.watchlistItems ?? payload.watchlists ?? payload.items)
    if (key === 'alertTerms') {
        const exported = objectValue(payload.alertTermsExport)
        bundle.alertTerms = normalizeAlertGenerationRecords<AlertTerm>(payload.activeTerms ?? exported?.activeTerms ?? payload.terms)
    }
    if (key === 'alertCaseVisibility') bundle.alertCaseVisibility = payload
    if (key === 'events') bundle.alerts = arrayValue<ScopedAlert>(payload.alerts ?? payload.items ?? payload.results)
    if (key === 'cases') bundle.cases = arrayValue<ScopedCase>(payload.cases ?? payload.items ?? payload.results)
    if (key === 'webhooks') bundle.webhooks = arrayValue<WebhookDestination>(payload.destinations ?? payload.webhooks)
    if (key === 'deliveries') bundle.deliveries = normalizedDeliveryRows(payload)
}
