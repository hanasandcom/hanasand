'use client'

export const TI_WORKBENCH_PREVIEW_ROWS = 1
export const TI_EVIDENCE_QUEUE_PREVIEW_ROWS = 2
export const TI_SELECTED_CONTEXT_ROWS = 2
export const TI_SELECTED_CONTINUITY_REF_ROWS = 2
export const TI_SELECTED_DETAIL_LIST_ROWS = 3
export const TI_SELECTED_SOURCE_REQUEST_ROWS = 2
export const TI_MOBILE_SOURCE_FILTER_OPTIONS = 5
export const TI_ACTIVITY_TIMELINE_ROWS = 3
export const TI_SOURCE_REFERENCE_ROWS = 2
export const TI_DOSSIER_REASON_ROWS = 3
export const TI_DOSSIER_SOURCE_FAMILY_ROWS = 3
export const TI_SAVED_SEARCHES_KEY = 'hanasand:ti:saved-searches'
export const TI_SAVED_SEARCH_LIMIT = 8
export type SavedSearch = { query: string, savedAt: string }

export * from './pageConstants'
export * from './pageEffects'
export * from './actorReferences'
export * from './useMediaQuery'
export * from './secondaryViews'
export * from './freshnessReviewPayload'
export * from './provenanceArtifactPayload'
export * from './actorEvidencePayloads'
export * from './analystWorkItems'
export * from './relatedRecordPayloads'
export * from './consumerReadiness'
export * from './sourcePresentation'
export * from './sourceCollectionPayloads'
export * from './caseReviewPresentation'
export * from './queryPresentation'
export * from './pageMeta'
