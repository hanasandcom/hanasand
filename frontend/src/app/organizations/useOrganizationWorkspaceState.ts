'use client'

import { useEffect, useRef, useState } from 'react'
import type { ActivityItem, ActivitySubject, CollectionRequest, RowMessage } from './types/activity'
import type { OrganizationRole, OrganizationSettings, OrganizationSummary } from './types/organization'
import type { OrgBundle } from './types/bundle'
import type { WatchlistKind } from './types/watchlists'
import { createInitialOrganizationBundle } from './model/organizationBundle'

export function useOrganizationWorkspaceState({
    organizations: initialOrganizations,
    loading: initialLoading,
    requestedOrganizationId,
}: { organizations: OrganizationSummary[], loading: boolean, requestedOrganizationId: string }) {
    const [organizations, setOrganizations] = useState(initialOrganizations)
    const [selectedId, setSelectedId] = useState(requestedOrganizationId)
    const [bundle, setBundle] = useState<OrgBundle>(createInitialOrganizationBundle)
    const [loading, setLoading] = useState(initialLoading)
    const [busy, setBusy] = useState('')
    const [error, setError] = useState('')
    const [message, setMessage] = useState('')
    const [messageTone, setMessageTone] = useState<'success' | 'warning'>('success')
    const [newApiKeySecret, setNewApiKeySecret] = useState('')
    const [createName, setCreateName] = useState('')
    const [createFormOpen, setCreateFormOpen] = useState(false)
    const createNameRef = useRef<HTMLInputElement>(null)
    const [workspaceQuery, setWorkspaceQuery] = useState('')
    const [organizationSearchOpen, setOrganizationSearchOpen] = useState(false)
    const organizationSearchRef = useRef<HTMLInputElement>(null)
    const [createFirstWatchlist, setCreateFirstWatchlist] = useState({ kind: 'domain' as WatchlistKind, value: '', notes: '' })
    const [createInviteEmails, setCreateInviteEmails] = useState('')
    const [createInviteRole, setCreateInviteRole] = useState<OrganizationRole>('reader')
    const [inviteEmails, setInviteEmails] = useState('')
    const [inviteRole, setInviteRole] = useState<OrganizationRole>('reader')
    const [watchlistDraft, setWatchlistDraft] = useState({ kind: 'domain' as WatchlistKind, value: '', notes: '' })
    const [settingsDraft, setSettingsDraft] = useState<OrganizationSettings>({})
    const [editingWatchlist, setEditingWatchlist] = useState<Record<string, { kind: WatchlistKind, value: string, notes: string }>>({})
    const [rowMessages, setRowMessages] = useState<Record<string, RowMessage>>({})
    const [activity, setActivity] = useState<ActivityItem[]>([])
    const [collectionRequest, setCollectionRequest] = useState<CollectionRequest | null>(null)
    const [selectedActivitySubject, setSelectedActivitySubject] = useState<ActivitySubject>({ type: 'organization', id: 'organization' })
    const mountedRef = useRef(false)
    const organizationLoadRef = useRef(0)
    const bundleLoadRef = useRef(0)
    const organizationSwitchFocusRef = useRef('')
    const workspaceFocusRef = useRef('')
    const collectionRequestKeyRef = useRef<{ organizationId: string, key: string } | null>(null)

    useEffect(() => { if (createFormOpen) createNameRef.current?.focus() }, [createFormOpen])
    useEffect(() => { if (organizationSearchOpen) organizationSearchRef.current?.focus() }, [organizationSearchOpen])
    useEffect(() => {
        const onKeyDown = (event: globalThis.KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'j') {
                event.preventDefault()
                setOrganizationSearchOpen(true)
            } else if (event.key === 'Escape') setOrganizationSearchOpen(false)
        }
        document.addEventListener('keydown', onKeyDown)
        return () => document.removeEventListener('keydown', onKeyDown)
    }, [])

    return {
        organizations, setOrganizations, selectedId, setSelectedId, bundle, setBundle, loading, setLoading,
        busy, setBusy, error, setError, message, setMessage, messageTone, setMessageTone,
        newApiKeySecret, setNewApiKeySecret, createName, setCreateName, createFormOpen, setCreateFormOpen,
        createNameRef, workspaceQuery, setWorkspaceQuery, organizationSearchOpen, setOrganizationSearchOpen,
        organizationSearchRef, createFirstWatchlist, setCreateFirstWatchlist, createInviteEmails,
        setCreateInviteEmails, createInviteRole, setCreateInviteRole, inviteEmails, setInviteEmails,
        inviteRole, setInviteRole, watchlistDraft, setWatchlistDraft, settingsDraft, setSettingsDraft,
        editingWatchlist, setEditingWatchlist, rowMessages, setRowMessages, activity, setActivity,
        collectionRequest, setCollectionRequest, selectedActivitySubject, setSelectedActivitySubject,
        mountedRef, organizationLoadRef, bundleLoadRef, organizationSwitchFocusRef, workspaceFocusRef,
        collectionRequestKeyRef,
    }
}
