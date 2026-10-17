import ensureSchema from '#utils/db/ensureSchema.ts'
import { cleanup, seedOrganization } from './smoke-dwm-webhooks/organization.ts'
import { createDestination } from './smoke-dwm-webhooks/destination.ts'
import { createAlert } from './smoke-dwm-webhooks/alert.ts'
import { exerciseDeliveries } from './smoke-dwm-webhooks/deliveries.ts'
import { verifyEvidence } from './smoke-dwm-webhooks/evidence.ts'
import { printSummary } from './smoke-dwm-webhooks/summary.ts'

async function main() {
    process.env.DWM_WEBHOOK_LIVE_DELIVERY = 'false'
    await ensureSchema()
    await cleanup()
    await seedOrganization()

    const destination = await createDestination()
    const alert = createAlert()
    const deliveries = await exerciseDeliveries(destination, alert)
    await verifyEvidence(destination, alert, deliveries)
    printSummary(destination.id)
}

main()
    .catch((error) => {
        console.error((error as Error & { details?: unknown }).details ?? error)
        process.exitCode = 1
    })
    .finally(cleanup)
