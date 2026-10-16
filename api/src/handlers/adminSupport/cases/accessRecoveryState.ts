import { uniqueTimelineValues } from '#utils/support/inspectionPackets.ts'

export function supportAccessRecoveryState(accessStatus: Record<string, any>, accessRecoveryPlan: Record<string, any>) {
    const accessBlockers = Array.isArray(accessStatus.blockers) ? accessStatus.blockers : []
    const recoveryBlockers = Array.isArray(accessRecoveryPlan.blockers) ? accessRecoveryPlan.blockers : []
    return {
        accessBlockers,
        recoveryBlockers,
        recoveryState: {
            accessStatus: accessStatus.overall || null,
            recoveryAvailable: Boolean(accessRecoveryPlan.available || accessRecoveryPlan.items?.length),
            blockers: uniqueTimelineValues([...accessBlockers, ...recoveryBlockers]),
        },
    }
}

