import type { DatabaseOverview } from './overviewTypes.ts'

export function sanitizeDatabaseError(error: unknown): DatabaseOverview['health'] {
    const err = error as { code?: string, message?: string }
    const code = err?.code || ''
    const message = (err?.message || '').toLowerCase()

    if (code === '28P01' || message.includes('password authentication failed')) {
        return {
            category: 'auth',
            message: 'Database metrics unavailable: the internal API cannot authenticate to PostgreSQL.',
            detail: 'Check DB_USER and DB_PASSWORD for the API service, then retry the dashboard.',
        }
    }

    if (code === '42501' || message.includes('permission denied')) {
        return {
            category: 'permission',
            message: 'Database metrics unavailable: the configured database user lacks telemetry permissions.',
            detail: 'Grant enough read access for pg_stat_activity, pg_database_size, and information_schema table counts.',
        }
    }

    if (['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'EAI_AGAIN', '08000', '08001', '08003', '08006'].includes(code)
        || message.includes('timeout')
        || message.includes('connection refused')
        || message.includes('getaddrinfo')) {
        return {
            category: 'network',
            message: 'Database metrics unavailable: the internal API cannot reach PostgreSQL.',
            detail: 'Check DB_HOST, DB_PORT, service health, and network access from the API container.',
        }
    }

    return {
        category: 'unknown',
        message: 'Database metrics unavailable: PostgreSQL telemetry could not be read.',
        detail: 'Check the API logs for the database metrics request and verify the database connection settings.',
    }
}
