import type { ToolResponse } from './types'

export type ResponseTab = 'response' | 'raw' | 'tree' | 'preview' | 'headers' | 'request' | 'curl' | 'http'
export type RequestEditorTab = 'headers' | 'body' | 'vars' | 'ai'

export type RequestRun = {
    id: string
    method: string
    url: string
    startedAt: string
    loading: boolean
    response: ToolResponse | null
}
