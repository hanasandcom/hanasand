import type { ApiBackgroundJobDefinition } from './types.ts'
import { API_CRON_CADENCE_SECONDS } from './shared.ts'
import { DROP_RATE_ALERT_REFRESH_JOB_ID } from '../../events/dropRateAlert.ts'
import { LOG_INGEST_ACCESS_DETECTION_JOB_ID } from '../../events/analyzeIngestAccess.ts'
import { LIVE_LOG_PROCESSOR_JOB_ID, RULE_REPROCESSOR_JOB_ID, STORED_LOG_PROCESSOR_JOB_ID } from '../../events/processor.ts'

export const eventProcessingJobDefinitions: ApiBackgroundJobDefinition[] = [
    {
        id: 'api-cron-health-monitor',
        name: 'Scheduled job health monitor',
        description: 'Checks blocked jobs, updates their cases, and sends Discord notifications.',
        category: 'Alerts',
        schedule: 'Every minute',
        cadenceSeconds: API_CRON_CADENCE_SECONDS,
        source: 'api/src/utils/systemCronMonitor.ts',
        controls: ['run_now'],
    },
    {
        id: LOG_INGEST_ACCESS_DETECTION_JOB_ID,
        name: 'Log-ingest abuse detection',
        description: 'Flushes access counters, checks configured request thresholds, and records abuse findings.',
        category: 'Alerts',
        schedule: 'Every minute',
        cadenceSeconds: 60,
        source: 'api/src/utils/events/analyzeIngestAccess.ts',
        controls: [],
        isEnabled: () => process.env.AUTH_SERVICE_ONLY !== '1',
    },
    {
        id: DROP_RATE_ALERT_REFRESH_JOB_ID,
        name: 'Drop-rule rate alert refresh',
        description: 'Checks recent drop-rule matches and creates alerts when configured rate thresholds are exceeded.',
        category: 'Alerts',
        schedule: 'Every 15 seconds',
        cadenceSeconds: 15,
        source: 'api/src/utils/events/dropRateAlert.ts',
        controls: [],
        isEnabled: () => process.env.AUTH_SERVICE_ONLY !== '1',
    },
    {
        id: STORED_LOG_PROCESSOR_JOB_ID,
        name: 'Stored event log processor',
        description: 'Drains stored event logs using the configured adaptive catch-up interval.',
        category: 'Other/System',
        schedule: 'Adaptive queue drain; configured catch-up interval and 5-second idle backoff',
        cadenceSeconds: null,
        source: 'api/src/utils/events/processor.ts',
        controls: [],
        isEnabled: () => process.env.API_HTTP_ONLY !== '1'
            && process.env.AUTH_SERVICE_ONLY !== '1'
            && process.env.LOG_CATCHUP_WORKER_DISABLED !== '1',
    },
    {
        id: LIVE_LOG_PROCESSOR_JOB_ID,
        name: 'Live event log processor',
        description: 'Drains live event logs with a 100-millisecond processing interval and idle backoff.',
        category: 'Other/System',
        schedule: 'Adaptive queue drain; up to 100-millisecond interval with 100-millisecond idle backoff',
        cadenceSeconds: null,
        source: 'api/src/utils/events/processor.ts',
        controls: [],
        isEnabled: () => process.env.API_HTTP_ONLY !== '1'
            && process.env.AUTH_SERVICE_ONLY !== '1'
            && process.env.LOG_LIVE_WORKER_DISABLED !== '1',
    },
    {
        id: RULE_REPROCESSOR_JOB_ID,
        name: 'Event rule reprocessor',
        description: 'Reprocesses stored events for updated rules using the adaptive queue worker.',
        category: 'Other/System',
        schedule: 'Adaptive queue drain; up to 1-second interval with 5-second idle backoff',
        cadenceSeconds: null,
        source: 'api/src/utils/events/processor.ts',
        controls: [],
        isEnabled: () => process.env.API_HTTP_ONLY !== '1'
            && process.env.AUTH_SERVICE_ONLY !== '1',
    },
    {
        id: 'api-hot-cache-refresh',
        name: 'API stats and Docker cache refresh',
        description: 'Refreshes cached API stats and Docker/container snapshots for dashboard resource telemetry.',
        category: 'Other/System',
        schedule: 'Every hot-cache interval',
        cadenceSeconds: null,
        source: 'api/src/utils/refresh/fp.ts',
        controls: [],
    },
]
