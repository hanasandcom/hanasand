import type { Dispatch, SetStateAction } from 'react'
import type { WorkflowResult, WorkflowRouteSummary } from './workflow-types'

export type WorkflowActionContext = {
    scope: { tenantId: string, organizationId?: string }
    organizationId?: string
    variant: 'workflow' | 'watchlist-editor'
    watchlistId?: string
    terms: string
    setTerms: Dispatch<SetStateAction<string>>
    webhookUrl: string
    webhookConfigured: boolean
    claimUrl: string
    setClaimUrl: Dispatch<SetStateAction<string>>
    claimActor: string
    claimCompany: string
    claimData: string
    sourceTarget: string
    setSourceTarget: Dispatch<SetStateAction<string>>
    setBusyAction: Dispatch<SetStateAction<string | null>>
    setResult: Dispatch<SetStateAction<WorkflowResult | null>>
    setLastRoute: Dispatch<SetStateAction<WorkflowRouteSummary | null>>
    onSaved?: () => void
    refreshWorkspace: () => void
    navigateToCase: (path: string) => void
}
