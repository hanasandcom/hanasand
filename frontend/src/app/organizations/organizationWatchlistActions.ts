import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { OrganizationSummary } from './types/organization'
import type { WatchlistKind, WatchlistItem } from './types/watchlists'
import type { CollectionRequest, DwmAlertBridgeResult } from './types/activity'
import type { WorkspaceAction } from './useWorkspaceActionRunner'
import type { OrgBundle } from './types/bundle'
import { isDuplicateWatchlistTerm, watchlistDraftChanged } from './model/watchlists'
import { sentenceCase } from './model/labels'
import { requestJson, watchlistMutationMessage } from './model/workspaceApi'

type WatchlistDraft = { kind: WatchlistKind, value: string, notes: string }
type WatchlistOptions = {
    selectedOrganization?: OrganizationSummary
    runAction: WorkspaceAction
    requireEdit: () => void
    requireManage: () => void
    watchlistDraft: WatchlistDraft
    setWatchlistDraft: Dispatch<SetStateAction<WatchlistDraft>>
    watchlistDraftDuplicate: boolean
    bundle: OrgBundle
    editingWatchlist: Record<string, WatchlistDraft>
    setEditingWatchlist: Dispatch<SetStateAction<Record<string, WatchlistDraft>>>
    collectionRequest: CollectionRequest | null
    setCollectionRequest: Dispatch<SetStateAction<CollectionRequest | null>>
    collectionRequestKeyRef: MutableRefObject<{ organizationId: string, key: string } | null>
    loadOrganizationBundle: (organizationId: string) => Promise<void>
}

export function createOrganizationWatchlistActions(options: WatchlistOptions) {
    const { selectedOrganization, runAction, requireEdit, requireManage, watchlistDraft, setWatchlistDraft,
        watchlistDraftDuplicate, bundle, editingWatchlist, setEditingWatchlist, collectionRequest,
        setCollectionRequest, collectionRequestKeyRef, loadOrganizationBundle } = options
    const createWatchlist = () => selectedOrganization && runAction('create-watchlist', async () => {
        requireEdit()
        if (watchlistDraftDuplicate) {
            throw new Error('This watchlist term already exists in this organization.')
        }
        const payload = await requestJson<{ dwmAlertBridge?: DwmAlertBridgeResult }>(`/api/organizations/${encodeURIComponent(selectedOrganization.id)}/watchlists`, {
            method: 'POST',
            body: JSON.stringify({
                ...watchlistDraft,
                reason: 'Shared watchlist term added from organization workspace.',
                requestId: `org-ui-${Date.now()}`,
            }),
        })
        setWatchlistDraft({ kind: 'domain', value: '', notes: '' })
        return watchlistMutationMessage(payload.dwmAlertBridge, `${watchlistDraft.value.trim()} saved.`)
    }, 'watchlist-create')

    const saveWatchlistEdit = (item: WatchlistItem) => selectedOrganization && runAction('save-watchlist', async () => {
        requireEdit()
        const draft = editingWatchlist[item.id]
        if (!draft) throw new Error('Open the watchlist term before saving.')
        if (isDuplicateWatchlistTerm(bundle.watchlists, draft.kind, draft.value, item.id)) {
            throw new Error('This watchlist term already exists in this organization.')
        }
        const changed = watchlistDraftChanged(item, draft)
        const payload = await requestJson<{ dwmAlertBridge?: DwmAlertBridgeResult }>(`/api/organizations/${encodeURIComponent(selectedOrganization.id)}/watchlists/${encodeURIComponent(item.id)}`, {
            method: 'PUT',
            body: JSON.stringify({
                kind: draft.kind,
                value: draft.value,
                notes: draft.notes,
                reason: 'Shared watchlist term updated from organization workspace.',
                requestId: `org-ui-${Date.now()}`,
            }),
        })
        setEditingWatchlist(current => {
            const next = { ...current }
            delete next[item.id]
            return next
        })
        return watchlistMutationMessage(payload.dwmAlertBridge, `${draft.value.trim()} ${changed ? 'updated' : 'synchronized'}.`)
    }, `watchlist-${item.id}`)

    const watchlistAction = (item: WatchlistItem, action: 'pause' | 'resume' | 'archive' | 'restore') => selectedOrganization && runAction(`${action}-watchlist`, async () => {
        requireEdit()
        const payload = await requestJson<{ dwmAlertBridge?: DwmAlertBridgeResult }>(`/api/organizations/${encodeURIComponent(selectedOrganization.id)}/watchlists/${encodeURIComponent(item.id)}/actions`, {
            method: 'POST',
            body: JSON.stringify({
                action,
                reason: `${sentenceCase(action)} from organization workspace.`,
                requestId: `org-ui-${Date.now()}`,
            }),
        })
        return watchlistMutationMessage(payload.dwmAlertBridge, `${item.value} ${action}d.`)
    }, `watchlist-${item.id}`)

    const deleteWatchlist = (item: WatchlistItem) => selectedOrganization && runAction('delete-watchlist', async () => {
        requireEdit()
        const payload = await requestJson<{ dwmAlertBridge?: DwmAlertBridgeResult }>(`/api/organizations/${encodeURIComponent(selectedOrganization.id)}/watchlists/${encodeURIComponent(item.id)}`, {
            method: 'DELETE',
            body: JSON.stringify({
                reason: 'Shared watchlist term retired from organization workspace.',
                requestId: `org-ui-${Date.now()}`,
            }),
        })
        return watchlistMutationMessage(payload.dwmAlertBridge, `${item.value} archived.`)
    }, `watchlist-${item.id}`)

    const cleanupWatchlists = () => selectedOrganization && runAction('cleanup-watchlists', async () => {
        requireManage()
        const payload = await requestJson<{ archivedCount?: number, cleanupCount?: number, disabledCount?: number, dwmAlertBridge?: DwmAlertBridgeResult }>(`/api/organizations/${encodeURIComponent(selectedOrganization.id)}/watchlists/cleanup`, {
            method: 'POST',
            body: JSON.stringify({
                reason: 'Archived watchlist cleanup from organization workspace.',
                requestId: `org-ui-${Date.now()}`,
            }),
        })
        const count = payload.archivedCount ?? payload.cleanupCount ?? payload.disabledCount
        return watchlistMutationMessage(payload.dwmAlertBridge, count === undefined ? 'Archived watchlists cleaned up.' : `${count} archived watchlist${count === 1 ? '' : 's'} cleaned up.`)
    }, 'watchlists-cleanup')

    const refreshOrganizationAlerts = () => selectedOrganization && runAction('refresh-events', async () => {
        requireEdit()
        const payload = await requestJson<{ savedAlertCount?: number, alertIds?: string[] }>('/api/findings/alerts/rebuild', {
            method: 'POST',
            body: JSON.stringify({
                organizationId: selectedOrganization.id,
                tenantId: selectedOrganization.tenantId || selectedOrganization.id,
                requestId: `org-ui-${Date.now()}`,
            }),
        })
        await loadOrganizationBundle(selectedOrganization.id)
        const count = Number(payload.savedAlertCount || payload.alertIds?.length || 0)
        return count ? `${count} event${count === 1 ? '' : 's'} refreshed from captures.` : 'No matching event was found in the available captures.'
    }, 'watchlist-refresh')

    const requestFreshCollection = () => selectedOrganization && runAction('fresh-collection', async () => {
        requireEdit()
        const organizationId = selectedOrganization.id
        const existingKey = collectionRequestKeyRef.current
        const idempotencyKey = existingKey?.organizationId === organizationId
            ? existingKey.key
            : `org-ui-${organizationId}-${crypto.randomUUID()}`
        collectionRequestKeyRef.current = { organizationId, key: idempotencyKey }
        const payload = await requestJson<{ collectionRequest?: CollectionRequest }>(`/api/organizations/${encodeURIComponent(selectedOrganization.id)}/collection-requests`, {
            method: 'POST',
            headers: { 'idempotency-key': idempotencyKey },
            body: JSON.stringify({ organizationId: selectedOrganization.id, tenantId: selectedOrganization.tenantId || selectedOrganization.id }),
        })
        const next = payload.collectionRequest || null
        setCollectionRequest(next)
        await loadOrganizationBundle(selectedOrganization.id)
        collectionRequestKeyRef.current = null
        return next ? `Fresh collection ${next.status}; ${next.captureCount || 0} captures and ${next.alertCount || 0} events reported.` : 'Collection request accepted.'
    }, 'fresh-collection')

    const refreshCollectionStatus = () => selectedOrganization && collectionRequest && runAction('collection-status', async () => {
        const payload = await requestJson<{ collectionRequest?: CollectionRequest }>(`/api/organizations/${encodeURIComponent(selectedOrganization.id)}/collection-requests/${encodeURIComponent(collectionRequest.requestId)}`)
        const next = payload.collectionRequest || collectionRequest
        setCollectionRequest(next)
        if (next.status === 'completed' || next.status === 'failed') await loadOrganizationBundle(selectedOrganization.id)
        return `Fresh collection ${next.status}; ${next.captureCount || 0} captures and ${next.alertCount || 0} events reported.`
    }, 'collection-status')
    return { createWatchlist, saveWatchlistEdit, watchlistAction, deleteWatchlist, cleanupWatchlists, refreshOrganizationAlerts, requestFreshCollection, refreshCollectionStatus }
}
