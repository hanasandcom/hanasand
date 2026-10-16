'use client'

import StatusIncidentHistory from './statusDashboard/StatusIncidentHistory'
import StatusOverview from './statusDashboard/StatusOverview'
import { useStatusDashboardState } from './statusDashboard/useStatusDashboardState'
import type { ServiceStatus } from '@/utils/status/getStatus'

type DashboardProps = {
    serviceStatus: ServiceStatus
    mode?: 'status' | 'incidents' | 'incident'
    incidentId?: string
}

export default function StatusDashboard({ serviceStatus, mode = 'status', incidentId }: DashboardProps) {
    const { currentStatus, monitoringUnavailable, now } = useStatusDashboardState(serviceStatus, mode, incidentId)

    if (mode === 'incident') {
        return <StatusIncidentHistory mode='incident' incidents={currentStatus.incidents} incidentId={incidentId} />
    }
    if (mode === 'incidents') {
        return <StatusIncidentHistory mode='incidents' incidents={currentStatus.incidents} />
    }
    return <StatusOverview status={currentStatus} monitoringUnavailable={monitoringUnavailable} now={now} />
}
