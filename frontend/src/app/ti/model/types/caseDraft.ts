import { type LocalRelevanceMark } from './core'
import { type SelectedCaseSourceRow } from './source'
import type { SelectedPublicActorContext } from './publicActorContext'

export type SelectedCaseDraft = SelectedPublicActorContext & {
    schemaVersion: 'ti.public_actor.selected_case_draft.v1'
    priority: 'critical' | 'high' | 'medium' | 'low'
    caseIntent: LocalRelevanceMark['caseIntent'] | 'not_set'
    ready: boolean
    endpoint: string
    route?: string
    missing: string[]
    watchTerms: string[]
    sourceRows: SelectedCaseSourceRow[]
    body: Record<string, unknown>
}
