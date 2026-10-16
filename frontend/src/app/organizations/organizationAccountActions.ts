import type { Dispatch, SetStateAction } from 'react'
import type { OrganizationApiKey, OrganizationSettings, OrganizationSummary } from './types/organization'
import type { WorkspaceAction } from './useWorkspaceActionRunner'
import { privacyActionRequestId, normalizeSettings, settingsValidationMessage } from './model/forms'
import { requestJson } from './model/workspaceApi'

type AccountOptions = {
    selectedOrganization?: OrganizationSummary
    runAction: WorkspaceAction
    requireManage: () => void
    setNewApiKeySecret: Dispatch<SetStateAction<string>>
    settingsDraft: OrganizationSettings
    settingsDirty: boolean
}

export function createOrganizationAccountActions(options: AccountOptions) {
    const { selectedOrganization, runAction, requireManage, setNewApiKeySecret, settingsDraft, settingsDirty } = options
    const createEventApiKey = (name: string) => selectedOrganization && runAction('create-event-api-key', async () => {
        requireManage()
        const payload = await requestJson<{ apiKey?: OrganizationApiKey, secret?: string }>(`/api/organizations/${encodeURIComponent(selectedOrganization.id)}/api-keys`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ name }),
        })
        if (!payload.secret) throw new Error('The API key was created without a secret. Contact support before sending logs.')
        setNewApiKeySecret(payload.secret)
        return { message: 'Organization API key created. Copy the secret now; it will not be shown again.' }
    }, 'event-api-key', { type: 'organization', id: selectedOrganization.id })

    const revokeEventApiKey = (apiKey: OrganizationApiKey) => selectedOrganization && runAction('revoke-event-api-key', async () => {
        requireManage()
        if (!window.confirm('Revoke this organization API key? Existing event senders will stop working.')) return 'No changes made.'
        await requestJson(`/api/organizations/${encodeURIComponent(selectedOrganization.id)}/api-keys/${encodeURIComponent(apiKey.id)}`, { method: 'DELETE' })
        setNewApiKeySecret('')
        return 'Organization API key revoked.'
    }, 'event-api-key', { type: 'organization', id: selectedOrganization.id })

    const saveSettings = () => selectedOrganization && runAction('save-settings', async () => {
        requireManage()
        if (!settingsDirty) return 'No settings changes.'
        const validationMessage = settingsValidationMessage(settingsDraft)
        if (validationMessage) throw new Error(validationMessage)
        await requestJson(`/api/organizations/${encodeURIComponent(selectedOrganization.id)}/settings`, {
            method: 'PUT',
            body: JSON.stringify(normalizeSettings(settingsDraft)),
        })
        return 'Organization settings updated.'
    }, 'settings')

    const runRetention = () => selectedOrganization && runAction('run-retention', async () => {
        requireManage()
        await requestJson(`/api/organizations/${encodeURIComponent(selectedOrganization.id)}/privacy`, {
            method: 'POST',
            body: JSON.stringify({ action: 'run_retention', requestId: privacyActionRequestId('retention') }),
        })
        return 'Retention run started. Progress and protected records are shown below.'
    }, 'privacy')

    const exportPrivacyData = () => selectedOrganization && runAction('export-privacy', async () => {
        requireManage()
        const payload = await requestJson<{ export?: Record<string, unknown> }>(`/api/organizations/${encodeURIComponent(selectedOrganization.id)}/privacy`, {
            method: 'POST',
            body: JSON.stringify({ action: 'export', requestId: privacyActionRequestId('export') }),
        })
        if (!payload.export) throw new Error('The privacy runtime returned no export data.')
        const url = URL.createObjectURL(new Blob([JSON.stringify(payload.export, null, 2)], { type: 'application/json' }))
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = `${selectedOrganization.slug || selectedOrganization.id}-privacy-export.json`
        anchor.click()
        URL.revokeObjectURL(url)
        return 'Organization data export completed.'
    }, 'privacy')

    const requestPrivacyDeletion = (confirmation: string, currentPassword: string) => selectedOrganization && runAction('delete-organization-data', async () => {
        requireManage()
        await requestJson(`/api/organizations/${encodeURIComponent(selectedOrganization.id)}/privacy`, {
            method: 'POST',
            body: JSON.stringify({ action: 'delete', requestId: privacyActionRequestId('deletion'), confirmation, currentPassword }),
        })
        return 'Privacy deletion requested. Protected evidence remains and eligible data is processed in bounded batches.'
    }, 'privacy')
    return { createEventApiKey, revokeEventApiKey, saveSettings, runRetention, exportPrivacyData, requestPrivacyDeletion }
}
