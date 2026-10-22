// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { defaultCustomStages, maxCustomStages, scenarioPresets, toK6Stages, totalDurationSeconds } from '../src/utils/test/trafficShapes'

test('baseline, ramp, and spike use valid k6 stage shapes', () => {
    const presets = scenarioPresets.filter(preset => preset.id !== 'custom')
    expect(presets.map(preset => preset.id)).toEqual(['baseline', 'ramp', 'spike'])

    for (const preset of presets) {
        expect(preset.stages.length).toBeGreaterThan(0)
        expect(preset.stages.length).toBeLessThanOrEqual(maxCustomStages)
        expect(preset.stages.every(stage => /^\d+[smh]$/.test(stage.duration))).toBe(true)
        expect(preset.stages.every(stage => Number.isInteger(stage.target) && stage.target >= 0 && stage.target <= 100)).toBe(true)
    }
})

test('custom stages map input seconds and user counts to k6 stages', () => {
    expect(totalDurationSeconds(defaultCustomStages)).toBe(30)
    expect(toK6Stages(defaultCustomStages)).toEqual([
        { duration: '10s', target: 1 },
        { duration: '10s', target: 5 },
        { duration: '10s', target: 1 },
    ])
})
