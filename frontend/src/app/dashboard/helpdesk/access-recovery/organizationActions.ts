import { useState, type SyntheticEvent, type Dispatch, type SetStateAction } from 'react'
import { minimumAuditReasonMessage, supportReasonIsSpecific } from './shared'
import type { ApiUsageResetPayload, InviteActionPayload, MemberRolePayload } from './types'

export function useOrganizationActions(setSubmitting: Dispatch<SetStateAction<string>>) {
    const [inviteActionResult, setInviteActionResult] = useState<InviteActionPayload | null>(null)
    const [memberRoleResult, setMemberRoleResult] = useState<MemberRolePayload | null>(null)
    const [apiUsageResetResult, setApiUsageResetResult] = useState<ApiUsageResetPayload | null>(null)
    const [inviteActionMessage, setInviteActionMessage] = useState<string>('')
    const [memberRoleMessage, setMemberRoleMessage] = useState<string>('')
    const [apiUsageResetMessage, setApiUsageResetMessage] = useState<string>('')

    async function submitInviteAction(event: SyntheticEvent<HTMLFormElement>) {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        const organizationId = String(form.get('organizationId') || '').trim()
        const inviteId = String(form.get('inviteId') || '').trim()
        const action = String(form.get('action') || 'resend') === 'revoke' ? 'revoke' : 'resend'
        const payload = {
            action,
            reason: String(form.get('reason') || '').trim(),
            context: String(form.get('context') || '').trim(),
            supportSessionId: String(form.get('supportSessionId') || '').trim(),
            idempotencyKey: String(form.get('idempotencyKey') || '').trim(),
            expiresAt: String(form.get('expiresAt') || '').trim() || undefined,
            scope: [action === 'revoke' ? 'invite:revoke' : 'invite:resend'],
        }
        if (!supportReasonIsSpecific(payload.reason)) {
            setInviteActionMessage(minimumAuditReasonMessage)
            return
        }

        setSubmitting('invite')
        setInviteActionMessage('')
        setInviteActionResult(null)
        try {
            const response = await fetch(`/api/backend/admin/support/organizations/${encodeURIComponent(organizationId)}/invites/${encodeURIComponent(inviteId)}/actions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            const body = await response.json().catch(() => ({})) as InviteActionPayload
            if (!response.ok) {
                setInviteActionMessage(body.error || 'Invite action failed.')
                setInviteActionResult(body)
                return
            }
            setInviteActionResult(body)
            setInviteActionMessage(action === 'revoke' ? 'Invite revoked.' : 'Invite resent.')
        } catch (error) {
            setInviteActionMessage(error instanceof Error ? error.message : 'Invite action failed.')
        } finally {
            setSubmitting('')
        }
    }

    async function submitMemberRoleRecovery(event: SyntheticEvent<HTMLFormElement>) {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        const organizationId = String(form.get('organizationId') || '').trim()
        const userId = String(form.get('userId') || '').trim()
        const payload = {
            role: String(form.get('role') || 'admin'),
            reason: String(form.get('reason') || '').trim(),
            context: String(form.get('context') || '').trim(),
            supportSessionId: String(form.get('supportSessionId') || '').trim(),
            idempotencyKey: String(form.get('idempotencyKey') || '').trim(),
            scope: ['member:role_recovery'],
        }
        if (!supportReasonIsSpecific(payload.reason)) {
            setMemberRoleMessage(minimumAuditReasonMessage)
            return
        }

        setSubmitting('member')
        setMemberRoleMessage('')
        setMemberRoleResult(null)
        try {
            const response = await fetch(`/api/backend/admin/support/organizations/${encodeURIComponent(organizationId)}/members/${encodeURIComponent(userId)}/role-recovery`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            const body = await response.json().catch(() => ({})) as MemberRolePayload
            if (!response.ok) {
                setMemberRoleMessage(body.error || 'Member role recovery failed.')
                setMemberRoleResult(body)
                return
            }
            setMemberRoleResult(body)
            setMemberRoleMessage('Member role recovered.')
        } catch (error) {
            setMemberRoleMessage(error instanceof Error ? error.message : 'Member role recovery failed.')
        } finally {
            setSubmitting('')
        }
    }

    async function submitApiUsageReset(event: SyntheticEvent<HTMLFormElement>) {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        const apiKeyId = String(form.get('apiKeyId') || '').trim()
        const payload = { reason: String(form.get('reason') || '').trim() }
        if (!supportReasonIsSpecific(payload.reason)) {
            setApiUsageResetMessage(minimumAuditReasonMessage)
            return
        }

        setSubmitting('apiUsage')
        setApiUsageResetMessage('')
        setApiUsageResetResult(null)
        try {
            const response = await fetch(`/api/backend/rate-limit/keys/${encodeURIComponent(apiKeyId)}/reset-usage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            const body = await response.json().catch(() => ({})) as ApiUsageResetPayload
            if (!response.ok) {
                setApiUsageResetMessage(body.error || 'API usage reset failed.')
                setApiUsageResetResult(body)
                return
            }
            setApiUsageResetResult(body)
            setApiUsageResetMessage('API usage buckets reset.')
        } catch (error) {
            setApiUsageResetMessage(error instanceof Error ? error.message : 'API usage reset failed.')
        } finally {
            setSubmitting('')
        }
    }

    return { inviteActionResult, memberRoleResult, apiUsageResetResult, inviteActionMessage, memberRoleMessage, apiUsageResetMessage, submitInviteAction, submitMemberRoleRecovery, submitApiUsageReset }
}
