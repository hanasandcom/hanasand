import { expect, test } from 'bun:test'
import { hostCheckMessage, hostMetricsDataWarning, isHostMetricsDataWarning } from '../src/utils/hostCheckMessage.ts'
import { monitoringIssueFingerprint } from '../src/utils/monitoringIssues.ts'
import { evaluateJsonRule } from '../src/utils/jsonMonitoring.ts'
import type { JsonRule } from '../src/utils/jsonMonitoring.ts'

for (const [path, name] of [['memoryPercent', 'RAM'], ['cpuPercent', 'CPU'], ['gpus.*.usedPercent', 'GPU'], ['storage.*.usedPercent', 'Storage']]) {
    test(`${name} describes normal and high usage`, () => {
        const rule: JsonRule = { path: `host.${path}`, operator: 'gt', aggregate: 'max', value: 80 }
        expect(hostCheckMessage(rule, 8.01, false)).toBe(`${name} usage is normal: 8.01% used (alert at 80%).`)
        expect(hostCheckMessage(rule, 81, true)).toContain(`${name} usage is high: 81% used (alert limit 80%).`)
        expect(hostCheckMessage(rule, 81, true)).toContain(name === 'Storage' ? 'free space or expand the volume.' : name === 'GPU' ? 'active GPU jobs' : name === 'RAM' ? 'memory-heavy processes' : 'CPU load')
        expect(hostCheckMessage(rule, 80.01, true)).toContain('80.01%')
        expect(hostCheckMessage(rule, 80, false)).toContain('normal')
        expect(hostCheckMessage(rule, 8, true, true)).toBeNull()
        expect(hostCheckMessage({ ...rule, operator: 'lt' }, 8, true)).toBeNull()
        const monitor = { target_url: 'system:metrics', monitoring_type: 'json' as const, json_rule: rule }
        const fingerprint = (message: string) => monitoringIssueFingerprint(monitor, 'failure', message)
        expect(fingerprint(hostCheckMessage(rule, 81, true)!)).toBe(fingerprint(hostCheckMessage(rule, 93, true)!))
        expect(fingerprint(hostCheckMessage(rule, 81, true)!)).toBe(fingerprint('JSON threshold exceeded: old format'))
        expect(fingerprint('Host telemetry is stale.')).not.toBe(fingerprint(hostCheckMessage(rule, 81, true)!))
    })
}
for (const [path, name, unit] of [['temperatures', 'Temperature', '°C'], ['power', 'Power usage', ' W']]) {
    test(`${name} describes distance from the sensor alert limit`, () => {
        const rule: JsonRule = { path: `host.${path}.*.margin`, operator: 'lt', aggregate: 'min', value: 0 }
        expect(hostCheckMessage(rule, 12, false)).toBe(`${name} is normal: 12${unit} below the alert limit.`)
        expect(hostCheckMessage(rule, -2.5, true)).toBe(`${name} is high: 2.5${unit} above the alert limit. Check the device and its workload.`)
        expect(hostCheckMessage(rule, -0.001, true)).toContain(`0.001${unit} above`)
        expect(hostCheckMessage(rule, 0, false)).toBe(`${name} is normal: at the alert limit.`)
        expect(hostCheckMessage(rule, null, false)).toBeNull()
        expect(hostCheckMessage({ ...rule, value: 5 }, 12, false)).toBeNull()
    })
}

test('temperature shows actual hottest reading and the configured Celsius threshold', () => {
    const rule: JsonRule = { path: 'host.temperatures.*.value', operator: 'gt', aggregate: 'max', value: 50 }
    expect(hostCheckMessage(rule, 39, false)).toBe('Temperature is normal: 39°C (alert above 50°C).')
    expect(hostCheckMessage(rule, 51, true)).toBe('Temperature is high: 51°C (alert above 50°C). Check cooling and sustained CPU/GPU load.')
    expect(hostCheckMessage(rule, 50, false)).toBe('Temperature is normal: 50°C (alert above 50°C).')
    expect(hostCheckMessage(rule, null, false)).toBeNull()
})

test('OVH checks retain readable threshold messages', () => {
    expect(hostCheckMessage({ path: 'hosts.ovhcloud.cpuPercent', operator: 'gt', aggregate: 'max', value: 80 }, 12, false)).toBe('CPU usage is normal: 12% used (alert at 80%).')
    expect(hostCheckMessage({ path: 'hosts.ovhcloud.power.*.margin', operator: 'lt', aggregate: 'min', value: 0 }, -2, true)).toContain('2 W above')
})

test('OVH temperature accepts readings through 60°C and alerts above it', () => {
    const rule: JsonRule = { path: 'hosts.ovhcloud.temperatures.*.value', operator: 'gt', aggregate: 'max', value: 60 }
    for (const temperature of [53, 60, 61]) {
        const { exceeded, observed } = evaluateJsonRule({ hosts: { ovhcloud: { temperatures: [{ value: 40 }, { value: temperature }] } } }, rule)
        expect(exceeded).toBe(temperature > 60)
        expect(hostCheckMessage(rule, observed, exceeded)).toBe(`Temperature is ${temperature > 60 ? 'high' : 'normal'}: ${temperature}°C (alert above 60°C).${temperature > 60 ? ' Check cooling and sustained CPU/GPU load.' : ''}`)
    }
})

test('missing or unusable host telemetry is clearly a monitor-data warning', () => {
    const missing = hostMetricsDataWarning('Inspur CPU', new Error('JSON field unavailable: host.cpuPercent.'))
    expect(missing).toBe('Host metrics unavailable for Inspur CPU: the CPU reading (host.cpuPercent) is missing or invalid in the latest snapshot. Host status is unknown. Check the metrics collector and its latest snapshot.')
    expect(isHostMetricsDataWarning(missing)).toBe(true)
    expect(hostMetricsDataWarning('OVH Storage', new Error('OVH host telemetry is stale.'))).toContain('OVH Storage: the latest host metrics snapshot is stale or unavailable')
})
