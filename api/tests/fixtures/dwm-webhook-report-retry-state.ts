import { createHash } from 'node:crypto'

export type QueryResult = { rows: any[] }

export const queries: Array<{ sql: string, params: unknown[] }> = []
export const ledger: Array<Record<string, any>> = []
export const receiverAudits: Array<Record<string, any>> = []
export const lockTails = new Map<string, Promise<void>>()
export const state: {
    persistedDelivery?: Record<string, any>
    insertedDelivery?: Record<string, any>
    receiverDestinationEndpointHash: string
    receiverDestinationStatus: string
    destinationEndpointHash: string
    missingDestinationId?: string
    orgDestinations: Array<Record<string, unknown>>
    failReceiptBind: boolean
} = {
    receiverDestinationEndpointHash: '',
    receiverDestinationStatus: 'active',
    destinationEndpointHash: 'endpoint_hash',
    orgDestinations: [],
    failReceiptBind: false,
}

const controlledReceiverUrl = 'https://hanasand.com/api/dwm/webhook-sink'
export const controlledReceiverEndpointHash = endpointHash(controlledReceiverUrl)
state.receiverDestinationEndpointHash = controlledReceiverEndpointHash

export let databaseRun: (sql: string, params?: unknown[]) => Promise<QueryResult>
export function setDatabaseRun(run: typeof databaseRun) { databaseRun = run }

export function resetDwmWebhookRetryState() {
    queries.length = 0
    ledger.length = 0
    receiverAudits.length = 0
    lockTails.clear()
    state.persistedDelivery = undefined
    state.insertedDelivery = undefined
    state.receiverDestinationEndpointHash = controlledReceiverEndpointHash
    state.receiverDestinationStatus = 'active'
    state.destinationEndpointHash = 'endpoint_hash'
    state.missingDestinationId = undefined
    state.orgDestinations = []
    state.failReceiptBind = false
}

function endpointHash(url: string) {
    return `endpoint_${createHash('sha256').update(new URL(url).toString()).digest('hex').slice(0, 32)}`
}
import { createHash } from 'node:crypto'
