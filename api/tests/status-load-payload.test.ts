import { expect, mock, test } from 'bun:test'
import type run from '#db'

mock.module('#db', () => ({
    default: async () => { throw new Error('The injected query should be used.') },
}))

const { loadStatusPayload } = await import('../src/utils/status/loadPayload.ts')

function deferred() {
    let release!: () => void
    let signalStarted!: () => void
    const waiting = new Promise<void>(resolve => { release = resolve })
    const started = new Promise<void>(resolve => { signalStarted = resolve })
    return { waiting, started, release, signalStarted }
}

test('loads current checks, daily history, and incident evidence sequentially', async () => {
    const currentStage = deferred()
    const historyStage = deferred()
    const incidentStage = deferred()
    const stages = [
        [
            { service: 'core', check_name: 'API health', status: 'up', latency_ms: 4, message: 'OK', checked_at: '2026-10-16T10:02:00Z', uptime_30d: '100.00' },
            { service: 'database', check_name: 'Connection', status: 'down', latency_ms: 0, message: 'Connection failed.', checked_at: '2026-10-16T10:03:00Z', uptime_30d: '98.00' },
            { service: 'auth', check_name: 'Login', status: 'down', latency_ms: 0, message: 'Excluded check.', checked_at: '2026-10-16T10:04:00Z', uptime_30d: '90.00' },
        ],
        [{
            service: 'database', check_name: 'Connection', date: '2026-10-16', samples: 3,
            healthy_samples: 1, degraded_samples: 0, failed_samples: 2, status: 'down',
        }],
        [{
            service: 'database', check_name: 'Connection', status: 'down', message: 'Connection failed.',
            checked_at: '2026-10-16T10:01:00Z', previous_status: 'up', previous_checked_at: '2026-10-16T10:00:00Z',
            next_status: 'up', next_checked_at: '2026-10-16T10:02:00Z', next_message: 'Connection restored.',
        }],
    ]
    const gates = [currentStage, historyStage, incidentStage]
    let callCount = 0
    const query = (async () => {
        const index = callCount++
        const gate = gates[index]
        if (!gate) throw new Error('Unexpected extra status query.')
        gate.signalStarted()
        await gate.waiting
        return { rows: stages[index] }
    }) as typeof run

    const pending = loadStatusPayload(false, query)
    await currentStage.started
    expect(callCount).toBe(1)
    currentStage.release()

    await historyStage.started
    expect(callCount).toBe(2)
    historyStage.release()

    await incidentStage.started
    expect(callCount).toBe(3)
    incidentStage.release()

    const payload = await pending
    expect(callCount).toBe(3)
    expect(payload).toMatchObject({
        overall: 'degraded',
        monitoring: 'live',
        generated_at: '2026-10-16T10:03:00.000Z',
        checks: [
            { service: 'core', check_name: 'API health', status: 'up', uptime_30d: '100.00' },
            { service: 'database', check_name: 'Connection', status: 'down', uptime_30d: '98.00' },
        ],
        history: [{
            service: 'database', check_name: 'Connection', date: '2026-10-16',
            samples: 3, healthy_samples: 1, degraded_samples: 0, failed_samples: 2, status: 'down',
            incident_ids: ['database-connection-2026-10-16t10-01-00-000z'],
        }],
        incidents: [{
            id: 'database-connection-2026-10-16t10-01-00-000z',
            service: 'database', check_name: 'Connection', status: 'resolved',
            started_at: '2026-10-16T10:01:00.000Z', resolved_at: '2026-10-16T10:02:00.000Z',
            updates: [
                { at: '2026-10-16T10:02:00.000Z', status: 'resolved', evidence: 'Connection restored.' },
                { at: '2026-10-16T10:01:00.000Z', status: 'investigating', evidence: 'Connection failed.' },
            ],
        }],
    })
})
