export function vmHostMigrationReleaseMarker(release: string | undefined, host: string | undefined) {
    return release && host === 'inspur' ? `${release}:vm-host-backfill:${host}` : null
}

export function shouldSkipSchemaRelease(releaseApplied: boolean, hostMarkerRequired: boolean, hostMarkerApplied: boolean) {
    return releaseApplied && (!hostMarkerRequired || hostMarkerApplied)
}

type QueryResult = { rowCount?: number | null }
export type SchemaReleaseQuery = (sql: string, params?: Array<string | number | null | boolean | string[] | Date>) => Promise<QueryResult>
type AdvisoryLock = <T>(key: string, work: (query: SchemaReleaseQuery) => Promise<T>) => Promise<T>
export type TrackedSchemaReleaseResult = 'schema-applied' | 'host-migration-applied' | 'already-applied'

export async function applyTrackedSchemaRelease(
    release: string,
    hostMarker: string | null,
    withAdvisoryLock: AdvisoryLock,
    applySchema: () => Promise<void>,
    applyHostMigration: () => Promise<void>,
): Promise<TrackedSchemaReleaseResult> {
    return withAdvisoryLock(`schema-release:${release}`, async query => {
        let releaseApplied = false
        let hostMarkerApplied = false
        try {
            releaseApplied = Boolean((await query('SELECT 1 FROM app_schema_releases WHERE release = $1', [release])).rowCount)
            if (releaseApplied && hostMarker) {
                hostMarkerApplied = Boolean((await query('SELECT 1 FROM app_schema_releases WHERE release = $1', [hostMarker])).rowCount)
            }
        } catch (error) {
            if ((error as { code?: string })?.code !== '42P01') throw error
        }

        if (shouldSkipSchemaRelease(releaseApplied, Boolean(hostMarker), hostMarkerApplied)) return 'already-applied'
        if (releaseApplied && hostMarker) {
            await applyHostMigration()
            await query('INSERT INTO app_schema_releases (release) VALUES ($1) ON CONFLICT DO NOTHING', [hostMarker])
            return 'host-migration-applied'
        }

        await applySchema()
        await query('CREATE TABLE IF NOT EXISTS app_schema_releases (release TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())')
        await query('INSERT INTO app_schema_releases (release) VALUES ($1) ON CONFLICT DO NOTHING', [release])
        if (hostMarker) await query('INSERT INTO app_schema_releases (release) VALUES ($1) ON CONFLICT DO NOTHING', [hostMarker])
        return 'schema-applied'
    })
}
