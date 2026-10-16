const loopbackHosts = new Set(['127.0.0.1', 'localhost', '::1'])

export function requireLogPipelineTestDatabase(): void {
    if (process.env.LOG_PIPELINE_TEST_DATABASE !== '1') {
        throw new Error('Set LOG_PIPELINE_TEST_DATABASE=1 to run this opt-in PostgreSQL test.')
    }
    if (process.env.DB !== 'logs_test') {
        throw new Error('Set DB=logs_test to run this opt-in PostgreSQL test.')
    }
    if (!loopbackHosts.has(process.env.DB_HOST ?? '')) {
        throw new Error('Set DB_HOST to 127.0.0.1, localhost, or ::1 to run this opt-in PostgreSQL test.')
    }
}
