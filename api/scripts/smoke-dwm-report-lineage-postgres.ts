import assert from 'node:assert/strict'
import ensureSchema from '../src/utils/db/ensureSchema.ts'
import { exerciseDeliveryPolicy } from './smoke-dwm-report-lineage-postgres/exercise-delivery-policy.ts'
import { exerciseRetryLineage } from './smoke-dwm-report-lineage-postgres/exercise-retry-lineage.ts'
import {
    cleanup, database, seed,
} from './smoke-dwm-report-lineage-postgres/support.ts'
import { verifyAfterRestart } from './smoke-dwm-report-lineage-postgres/verify-after-restart.ts'

const phase = process.argv[2]
assert.equal(process.env.DB, database, `Refusing to run outside the disposable ${database} database.`)
assert.ok(['exercise', 'verify', 'cleanup'].includes(phase), 'Usage: bun scripts/smoke-dwm-report-lineage-postgres.ts exercise|verify|cleanup')
process.env.DWM_WEBHOOK_LIVE_DELIVERY = 'true'
process.env.TI_SCRAPER_SERVICE_TOKEN = 'reporting-pg-receiver-signature'
process.env.DWM_CONTROLLED_RECEIVER_URLS = 'https://hanasand.com/api/dwm/webhook-sink'

if (phase === 'exercise') {
    await ensureSchema()
    await cleanup()
    await seed()
    const policy = await exerciseDeliveryPolicy()
    const retry = await exerciseRetryLineage()
    console.log(JSON.stringify({ phase, database, ...policy, ...retry,
        next: `Stop and restart PostgreSQL, then rerun this script with DB=${database} and phase verify; verification waits until the persisted retry due time.`,
    }, null, 2))
}
if (phase === 'verify') await verifyAfterRestart(phase)
if (phase === 'cleanup') await cleanup(phase)
