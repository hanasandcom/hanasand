import type { OrganizationSettings, OrganizationPrivacyState, OrganizationMember, OrganizationInvite, OrganizationApiKey, OrganizationLoadError } from './organization'
import type { WatchlistItem, AlertTerm } from './watchlists'
import type { ScopedAlert, ScopedCase } from './activity'
import type { WebhookDestination, DeliveryRow } from './delivery'

export type OrgBundle = {
    settings: OrganizationSettings | null
    privacy: OrganizationPrivacyState | null
    members: OrganizationMember[]
    invites: OrganizationInvite[]
    watchlists: WatchlistItem[]
    alertTerms: AlertTerm[]
    alerts: ScopedAlert[]
    cases: ScopedCase[]
    webhooks: WebhookDestination[]
    deliveries: DeliveryRow[]
    alertCaseVisibility: Record<string, unknown> | null
    apiKeys: OrganizationApiKey[]
    loadErrors: OrganizationLoadError[]
}
