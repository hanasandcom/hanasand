import { listUnifiedScheduledJobs } from './unifiedInventory.ts'
import type { ManagedCronUpdate } from './types.ts'

export async function updateExternallyManagedCronJob(
    id: string,
    input: ManagedCronUpdate,
    options: {
        runNow?: { run: () => Promise<unknown>, label: string }
        setPaused?: (paused: boolean) => Promise<unknown>
    },
) {
    const runNow = options.runNow
    if (input.action === 'run_now' && runNow) {
        void runNow.run().catch(error => {
            console.error(`Failed to run ${runNow.label} from Cron Jobs dashboard`, error)
        })
    }
    if (input.enabled !== undefined && options.setPaused) await options.setPaused(!input.enabled)
    return updatedScheduledJob(id)
}

export async function updatedScheduledJob(id: string) {
    return (await listUnifiedScheduledJobs()).find(job => job.id === id)!
}
