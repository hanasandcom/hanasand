import type { AgentAutomation } from '@/utils/automations/client'
import { healthCheckStatus } from './healthCheckSorting'

type Props = { automation: AgentAutomation, variant: 'row' | 'details' }

export function HealthCheckStatusPill({ automation, variant }: Props) {
    const missingUrl = automation.actionType === 'agent_prompt' && !automation.targetUrl
    const failed = Boolean(automation.consecutiveFailures || automation.lastStatus === 'failed' || missingUrl)
    const warning = automation.lastStatus === 'warning'
    const tone = failed
        ? 'bg-ui-raised/10 text-ui-text'
        : warning
            ? 'bg-ui-warning/10 text-ui-warning'
            : automation.status === 'active' && (automation.monitoringType !== 'push' || automation.lastStatus)
                ? 'bg-ui-success/10 text-ui-success'
                : 'bg-ui-raised text-ui-muted'
    const size = variant === 'row'
        ? 'w-fit rounded-full px-2 py-1 text-xs font-semibold'
        : 'mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold'

    return <span className={`${size} ${tone}`}>{healthCheckStatus(automation)}</span>
}
