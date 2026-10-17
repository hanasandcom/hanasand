import { parseExistingCronEntries, parseManagedBlock } from '../systemCronCrontab.ts'
import { readManagedCronLog, readManagedCrontab } from '../managedCronHost.ts'
import { managedCronDefinitions } from './managedDefinitions.ts'
import type { ManagedCronJob } from './types.ts'

export async function listManagedCronJobs(): Promise<ManagedCronJob[]> {
    const { entries } = await readManagedCronState()

    return Promise.all(managedCronDefinitions.map(async(definition) => {
        const entry = entries.get(definition.id)
        const log = await readManagedCronLog(definition.logPath)

        return {
            ...definition,
            schedule: entry?.schedule || definition.defaultSchedule,
            enabled: entry ? entry.enabled : false,
            installed: Boolean(entry),
            lastLogLine: log.line,
            lastLogAt: log.createdAt,
        }
    }))
}


export async function readManagedCronState() {
    const crontab = await readManagedCrontab()
    const entries = parseManagedBlock(crontab)
    const existingEntries = parseExistingCronEntries(crontab, managedCronDefinitions)
    for (const [id, entry] of existingEntries) {
        if (!entries.has(id)) entries.set(id, entry)
    }
    return { crontab, entries }
}
