import './guard-production-smoke.mjs'
import { createSmokeContext, cleanupSmoke } from './smoke-admin-access-recovery-live-fixture.mjs'
import { runAdminAccessRecoverySmoke } from './smoke-admin-access-recovery-live-flow.mjs'

const dbPassword = process.env.DB_PASSWORD
const runLive = process.env.RUN_ADMIN_SUPPORT_LIVE_SMOKE === '1'
const keepData = process.env.KEEP_ADMIN_SUPPORT_SMOKE_DATA === '1'

if (!runLive || !dbPassword) {
    printChecklist()
    process.exit(0)
}

const context = createSmokeContext({ dbPassword })
runAdminAccessRecoverySmoke(context)
    .catch(error => {
        console.error('Admin access recovery live smoke failed.')
        console.error(error?.stack || error)
        if (error?.details !== undefined) console.error(JSON.stringify(error.details, null, 2))
        process.exitCode = 1
    })
    .finally(async () => {
        if (!keepData) await cleanupSmoke(context)
        await context.pool.end().catch(() => {})
    })

function printChecklist() {
    console.log([
        'Admin access recovery live smoke is ready but not running.',
        '',
        'Prerequisites:',
        '- API is already listening locally, for example API_BASE=http://127.0.0.1:8080/api',
        '- Postgres is already listening; this script will not start Docker',
        '- DB_PASSWORD is set, plus optional DB_HOST, DB_PORT, DB, DB_USER',
        '- RUN_ADMIN_SUPPORT_LIVE_SMOKE=1 is set to allow live mutations',
        '',
        'One-command live check:',
        'RUN_ADMIN_SUPPORT_LIVE_SMOKE=1 API_BASE=${API_BASE:-http://127.0.0.1:8080/api} DB_HOST=${DB_HOST:-127.0.0.1} DB_PORT=${DB_PORT:-8503} DB_PASSWORD=... bun scripts/smoke-admin-access-recovery-live.mjs',
        '',
        'The live check creates two temporary admins and one temporary org, verifies support inspection by org/email/request, pending recovery revokes the invite, approval re-enables it, invite revoke/resend support actions keep membership untouched, denial keeps it revoked, approval/search/timeline filters work by request/status/outcome/requester/approver/entity/action, and audit ids are returned.',
        'Set KEEP_ADMIN_SUPPORT_SMOKE_DATA=1 to keep the seeded records for manual inspection.',
    ].join('\n'))
}
