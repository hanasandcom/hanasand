import run from '#db'
import { loadSQL } from '#utils/loadSQL.ts'
import { withLiveVmStatuses } from '#utils/vms/status.ts'

export default async function systemVms() {
    const [inventory, metrics] = await Promise.all([
        run(await loadSQL('getFullVmList.sql')),
        run(await loadSQL('getLatestVmMetrics.sql')),
    ])
    const vms = await withLiveVmStatuses(inventory.rows)
    return { vms, vmMetrics: metrics.rows }
}
