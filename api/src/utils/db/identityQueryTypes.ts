type QueryResult = { rows: Record<string, any>[]; rowCount: number | null }
export type IdentityQuery = (sql: string, params?: (string | number | null | boolean | string[] | Date)[]) => Promise<QueryResult>
