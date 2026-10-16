'use client'

import { useCallback, useEffect, useMemo } from 'react'
import type { OrganizationLoadError } from './types/organization'
import type { OrganizationPage } from '@/utils/organizations/pages'
import type { OrganizationSummary } from './types/organization'
import type { useOrganizationWorkspaceState } from './useOrganizationWorkspaceState'
import { endpointErrorMessage, errorMessage, isServerUnavailable } from './model/labels'
import { initialOrganizationBundle, mergeOrganizationPayload, organizationBundleKeysByPage } from './model/organizationBundle'
import { requestJson } from './model/workspaceApi'
import { focusForSubjectType, currentOrganizationFocus, replaceOrganizationWorkspaceSelectionUrl, requestedSubjectFromSearch } from './model/activityNavigation'
import type { ActivitySubject as WorkspaceSubject } from './types/activity'

type WorkspaceState = ReturnType<typeof useOrganizationWorkspaceState>
type WorkspaceDataOptions = {
    state: WorkspaceState
    activePage: OrganizationPage
    workspaceOrganizations: OrganizationSummary[]
    workspaceLoading: boolean
    requestedOrganizationId: string
    requestedFocus: string
    requestedInviteId: string
    requestedMemberId: string
    requestedWatchlistId: string
    requestedDestinationId: string
    requestedDeliveryId: string
    requestedAlertId: string
    requestedCaseId: string
    switchOrganization: (organizationId: string) => void | Promise<void>
}

export function useOrganizationWorkspaceData(options: WorkspaceDataOptions) {
    const { state, activePage, workspaceOrganizations, workspaceLoading, requestedOrganizationId,
        requestedFocus, requestedInviteId, requestedMemberId, requestedWatchlistId, requestedDestinationId,
        requestedDeliveryId, requestedAlertId, requestedCaseId, switchOrganization } = options
    const { organizations, setOrganizations, selectedId, setSelectedId, bundleLoadRef, organizationLoadRef,
        bundle, setBundle, loading, setLoading, setError, setBusy, settingsDraft, setSettingsDraft,
        selectedActivitySubject, setSelectedActivitySubject, organizationSwitchFocusRef, workspaceFocusRef, mountedRef } = state
    const selectedOrganization = useMemo(
        () => organizations.find(item => item.id === selectedId) || organizations[0], [organizations, selectedId],
    )
    useEffect(() => {
        mountedRef.current = true
        return () => { mountedRef.current = false }
    }, [mountedRef])

    const loadOrganizations = useCallback(async (nextSelectedId?: string) => {
        const requestId = ++organizationLoadRef.current
        setLoading(true)
        setError('')
        try {
            const payload = await requestJson<{ organizations?: OrganizationSummary[] }>('/api/organizations')
            if (!mountedRef.current || organizationLoadRef.current !== requestId) return
            const nextOrganizations = payload.organizations || []
            setOrganizations(nextOrganizations)
            const preferred = nextSelectedId || requestedOrganizationId || selectedId
            const nextSelected = nextOrganizations.find(item => item.id === preferred)?.id || ''
            setSelectedId(nextSelected)
            if (!nextSelected) setBundle(initialOrganizationBundle)
        } catch (error) {
            if (!mountedRef.current || organizationLoadRef.current !== requestId) return
            setError(errorMessage(error))
            setOrganizations([])
            setSelectedId('')
            setBundle(initialOrganizationBundle)
        } finally {
            if (mountedRef.current && organizationLoadRef.current === requestId) setLoading(false)
        }
    }, [organizationLoadRef, mountedRef, requestedOrganizationId, selectedId, setBundle, setError, setLoading, setOrganizations, setSelectedId])

    const loadOrganizationBundle = useCallback(async (organizationId: string) => {
        const requestId = ++bundleLoadRef.current
        setBusy('load-org')
        setError('')
        const organization = organizations.find(item => item.id === organizationId)
        const mayManage = ['owner', 'admin'].includes(organization?.role?.toLowerCase() || '')
        const base = `/api/organizations/${encodeURIComponent(organizationId)}`
        const endpoints = [
            ['settings', `${base}/settings`], ['apiKeys', `${base}/api-keys`], ['privacy', `${base}/privacy`],
            ['members', `${base}/members`], ['invites', `${base}/invites`], ['watchlists', `${base}/watchlists`],
            ['alertTerms', `${base}/watchlists/alert-terms`], ['alertCaseVisibility', `${base}/alert-case-visibility`],
            ['events', `/api/findings/alerts?organizationId=${encodeURIComponent(organizationId)}`],
            ['cases', `/api/cases?organizationId=${encodeURIComponent(organizationId)}`], ['webhooks', `${base}/webhooks`],
            ['deliveries', `/api/findings/webhooks/deliveries?organizationId=${encodeURIComponent(organizationId)}`],
        ] as const
        const required = new Set(organizationBundleKeysByPage[activePage])
        const allowed = endpoints.filter(([key]) => required.has(key) && (mayManage || !['apiKeys', 'invites'].includes(key)))
        const results = await Promise.allSettled(allowed.map(([, url]) => requestJson<Record<string, unknown>>(url)))
        if (!mountedRef.current || bundleLoadRef.current !== requestId) return
        const nextBundle = { ...initialOrganizationBundle, loadErrors: [] as OrganizationLoadError[] }
        results.forEach((result, index) => {
            const [key] = allowed[index]
            if (result.status === 'rejected') {
                nextBundle.loadErrors.push({ endpoint: key, message: endpointErrorMessage(result.reason), serviceUnavailable: isServerUnavailable(result.reason) })
            } else mergeOrganizationPayload(nextBundle, key, result.value, organization)
        })
        setBundle(nextBundle)
        setSettingsDraft(nextBundle.settings || {})
        const switchFocus = organizationSwitchFocusRef.current
        organizationSwitchFocusRef.current = ''
        const subject = requestedSubjectFromSearch({ organizationId, focus: switchFocus || requestedFocus,
            inviteId: requestedInviteId, memberId: requestedMemberId, watchlistId: requestedWatchlistId,
            destinationId: requestedDestinationId, deliveryId: requestedDeliveryId, alertId: requestedAlertId,
            caseId: requestedCaseId }, nextBundle)
        workspaceFocusRef.current = focusForSubjectType(subject.type)
        setSelectedActivitySubject(subject)
        if (switchFocus) replaceOrganizationWorkspaceSelectionUrl(organizationId, subject)
        setBusy('')
    }, [activePage, organizations, bundleLoadRef, mountedRef, requestedAlertId, requestedCaseId,
        requestedDeliveryId, requestedDestinationId, requestedFocus, requestedInviteId, requestedMemberId,
        requestedWatchlistId, organizationSwitchFocusRef, workspaceFocusRef, setBusy, setBundle,
        setError, setSelectedActivitySubject, setSettingsDraft])

    const selectOrganization = useCallback((organizationId: string) => {
        organizationSwitchFocusRef.current = focusForSubjectType(selectedActivitySubject.type)
            || workspaceFocusRef.current || currentOrganizationFocus() || requestedFocus
        void switchOrganization(organizationId)
        const subject: WorkspaceSubject = { type: 'organization', id: organizationId }
        setSelectedActivitySubject(subject)
        replaceOrganizationWorkspaceSelectionUrl(organizationId, subject)
    }, [organizationSwitchFocusRef, selectedActivitySubject.type, workspaceFocusRef, requestedFocus, switchOrganization, setSelectedActivitySubject])

    const selectActivitySubject = useCallback((subject: WorkspaceSubject) => {
        workspaceFocusRef.current = focusForSubjectType(subject.type)
        setSelectedActivitySubject(subject)
        replaceOrganizationWorkspaceSelectionUrl(selectedOrganization?.id || selectedId, subject)
    }, [workspaceFocusRef, setSelectedActivitySubject, selectedOrganization?.id, selectedId])

    useEffect(() => {
        setOrganizations(workspaceOrganizations)
        setLoading(workspaceLoading)
        setSelectedId(current => workspaceOrganizations.some(item => item.id === current) ? current
            : workspaceLoading ? requestedOrganizationId
                : workspaceOrganizations.find(item => item.id === requestedOrganizationId)?.id || workspaceOrganizations[0]?.id || '')
    }, [requestedOrganizationId, workspaceLoading, workspaceOrganizations, setLoading, setOrganizations, setSelectedId])
    useEffect(() => { if (selectedOrganization?.id) void loadOrganizationBundle(selectedOrganization.id) }, [selectedOrganization?.id, loadOrganizationBundle])

    return { selectedOrganization, loadOrganizations, loadOrganizationBundle, selectOrganization, selectActivitySubject }
}
