import type { CaseDetailState, WorkbenchActionOutcome, WorkbenchCase, WorkbenchInvitePayload, WorkbenchOrgContext, WorkbenchWatchlistUpsertPayload } from './types'
import type { Dispatch, SetStateAction } from 'react'
import { orgInviteDisabledReason, watchlistMutationDisabledReason } from './modules/actionInputs'
import { inferTermKind, suggestedWatchTerm } from './modules/watchlistHelpers'
import { readJson } from './modules/payloadParsing'
import { scopeBody } from './modules/actionMessages'
import type { WorkbenchPersistentAction } from './useWorkbenchActionState'

export function useOrganizationWorkflowActions(input: {
    orgContext?: WorkbenchOrgContext
    selectedCaseDetail?: CaseDetailState
    inviteEmail: string
    setInviteEmail: Dispatch<SetStateAction<string>>
    inviteRole: string
    runPersistentAction: WorkbenchPersistentAction
    setMessage: Dispatch<SetStateAction<WorkbenchActionOutcome | null>>
}) {
    const { orgContext, selectedCaseDetail, inviteEmail, setInviteEmail, inviteRole, runPersistentAction, setMessage } = input

    async function createSharedWatchlistTerm(item: WorkbenchCase) {
        const disabledReason = watchlistMutationDisabledReason(orgContext, selectedCaseDetail)
        if (disabledReason) { setMessage({ ok: false, text: disabledReason }); return }
        const term = suggestedWatchTerm(item)
        if (!term) { setMessage({ ok: false, text: 'Select a case term before creating a shared watchlist entry.' }); return }
        if (!orgContext?.createWatchlistAction) {
            setMessage({ ok: false, text: orgContext?.readiness.blockedReasons[0] || 'Connect the organization watchlist service before saving shared terms.' })
            return
        }
        await runPersistentAction(`watchlist:${item.id}`, async () => {
            const body: WorkbenchWatchlistUpsertPayload = {
                ...(orgContext.createWatchlistAction?.body || {}),
                name: orgContext.organization ? `${orgContext.organization.name} shared exposure watchlist` : 'Shared exposure watchlist',
                terms: [{ value: term, kind: inferTermKind(term) }], status: 'active',
            }
            const response = await fetch(orgContext.createWatchlistAction?.href || '/api/findings/watchlists', {
                method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
            })
            const payload = await readJson(response)
            if (!response.ok) throw new Error(payload.error?.message || response.statusText)
            return payload.watchlist?.id ? `Shared watchlist ${payload.watchlist.id} now covers ${term}.` : `Shared watchlist term ${term} saved.`
        })
    }

    async function inviteOrganizationMember() {
        const disabledReason = orgInviteDisabledReason(orgContext, selectedCaseDetail)
        if (disabledReason) { setMessage({ ok: false, text: disabledReason }); return }
        const organizationId = orgContext?.organization?.id
        if (!organizationId) { setMessage({ ok: false, text: 'Select an organization before inviting a teammate.' }); return }
        if (!inviteEmail.trim()) { setMessage({ ok: false, text: 'Invite requires an email address.' }); return }
        await runPersistentAction('org:invite', async () => {
            const body: WorkbenchInvitePayload = { email: inviteEmail.trim(), role: inviteRole, invitedBy: 'dashboard' }
            const response = await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/invites`, {
                method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
            })
            const payload = await readJson(response)
            if (!response.ok) throw new Error(payload.error?.message || response.statusText)
            setInviteEmail('')
            return payload.invites?.length ? `Invited ${payload.invites.length} teammate${payload.invites.length === 1 ? '' : 's'}.` : 'Invite queued.'
        })
    }

    async function upsertWatchlist(input: { watchlist: WorkbenchOrgContext['watchlists'][number], terms?: Array<{ value: string, kind?: string }>, status?: string }) {
        const disabledReason = watchlistMutationDisabledReason(orgContext, selectedCaseDetail)
        if (disabledReason) { setMessage({ ok: false, text: disabledReason }); return }
        await runPersistentAction(`watchlist:update:${input.watchlist.id}`, async () => {
            const body: WorkbenchWatchlistUpsertPayload = {
                ...scopeBody(orgContext), id: input.watchlist.id, name: input.watchlist.name,
                terms: input.terms || input.watchlist.terms, status: input.status || input.watchlist.status,
                webhookDestinationId: input.watchlist.webhookDestinationId,
            }
            const response = await fetch('/api/findings/watchlists', {
                method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
            })
            const payload = await readJson(response)
            if (!response.ok) throw new Error(payload.error?.message || response.statusText)
            return payload.watchlist?.id ? `Watchlist ${payload.watchlist.id} updated.` : 'Watchlist updated.'
        })
    }

    return { createSharedWatchlistTerm, inviteOrganizationMember, upsertWatchlist }
}
