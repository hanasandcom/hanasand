import type { RoutineLog } from '../src/utils/events/analyzeRoutineGroups.ts'

export function transportFixture(): RoutineLog[] {
    return ['debug2: channel 0: window 1966080 sent adjust 131072', 'debug3: send packet: type 93', 'debug2: channel 0: rcvd adjust 32768', 'debug3: receive packet: type 93'].map((message, i) => ({
        service: 'sshd', host: 'inspur', level: 'debug', message, timestamp: new Date(Date.now() - 2000 + i * 20).toISOString(), sourceEventId: String(i + 1).repeat(64),
        metadata: { collector: 'journal', unit: 'ssh.service', pid: '3532511', user: { id: '1000' } },
    }))
}
