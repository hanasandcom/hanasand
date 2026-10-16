import type { RoutineLog } from '../src/utils/events/analyzeRoutineGroups.ts'

export function telemetryFixture(now = Date.now()): RoutineLog[] {
    return ['Starting hanasand-host-metrics.service - Collect Hanasand host telemetry...', 'hanasand-host-metrics.service: Deactivated successfully.', 'Finished hanasand-host-metrics.service - Collect Hanasand host telemetry.'].map((message, i) => ({
        host: 'inspur', service: 'systemd', level: 'info', message, timestamp: new Date(now - 2000 + i * 100).toISOString(), sourceEventId: String(i + 1).repeat(64),
        metadata: { collector: 'journal', pid: '1', unit: 'init.scope', user: { id: '0' } },
    }))
}

export function sshFixture(now = Date.now()): RoutineLog[] {
    return [`Accepted publickey for monitor from 192.0.2.10 port 41000 ssh2: ED25519 SHA256:${'a'.repeat(43)}`, 'debug2: channel 0: rcvd adjust 32768', 'debug2: channel 0: window 16384 sent adjust 32768', 'Disconnected from user monitor 192.0.2.10 port 41000'].map((message, i) => ({
        host: 'inspur', service: 'sshd', level: i === 1 || i === 2 ? 'debug' : 'info', message, timestamp: new Date(now - 2000 + i * 100).toISOString(), sourceEventId: String(i + 1).repeat(64),
        metadata: { collector: 'journal', pid: '12456', unit: 'ssh.service', user: { id: '0' } },
    }))
}
