import type { RequestDraft, RequestHistoryEntry } from './types'

export type NewRequestProps = {
    initialRequest: RequestDraft
    selectedRequestId?: string | null
    runToken: number
    onRequestComplete: (entry: RequestHistoryEntry) => void
    share: Share | null
}
