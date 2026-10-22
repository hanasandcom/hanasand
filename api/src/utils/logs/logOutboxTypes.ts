export type Organization = {
    id: string
    name: string
    status: string
    retention_days: number
    audit_safe_metadata: Record<string, unknown>
    updated_at: Date | string
}
