import { type LocalRelevanceMark } from './core'
import { type SelectedCaseSourceRow } from './source'

export type SelectedCaseDraft = {
    schemaVersion: 'ti.public_actor.selected_case_draft.v1'
    source: 'public-ti'
    sessionLocal: true
    query: string
    generatedAt: string
    selectedItemId: string
    title: string
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
