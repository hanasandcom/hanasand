import type { DatabaseOverview } from '@/utils/db/internal'

export type Instance = NonNullable<DatabaseOverview['storage']>['instances'][number]
export type Database = Instance['databases'][number]
export type Item = { schema: string, name: string, sizeBytes: number | null, columns?: string[], lastWriteObservedAt?: string | null, type?: string }
export type Page = { rows?: Record<string, unknown>[], fields?: string[], items?: Item[], nextCursor: string | null, elapsedMs?: number, totalRows?: number | null }
export type Sort<K extends string> = { key: K, descending: boolean }
export type DatabaseSort = 'name' | 'instance' | 'health' | 'count' | 'connections' | 'size'
export type ItemSort = 'name' | 'write' | 'size'
