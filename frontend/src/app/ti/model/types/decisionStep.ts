export type DecisionStep = {
    id: string
    label: string
    status: 'ready' | 'review' | 'blocked'
    detail: string
    payload: unknown
    route?: string
    missing: string[]
}
