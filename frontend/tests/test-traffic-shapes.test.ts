// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { customCurveSteps, defaultCustomStages, maxCustomStages, maxCustomUsers, scenarioPresets, toK6Stages, totalDurationSeconds } from '../src/utils/test/trafficShapes'

test('baseline, ramp, and spike use valid k6 stage shapes', () => {
    const presets = scenarioPresets.filter(preset => preset.id !== 'custom')
    expect(presets.map(preset => preset.id)).toEqual(['baseline', 'ramp', 'spike'])

    for (const preset of presets) {
        expect(preset.stages.length).toBeGreaterThan(0)
        expect(preset.stages.length).toBeLessThanOrEqual(maxCustomStages)
        expect(preset.stages.every(stage => /^\d+[smh]$/.test(stage.duration))).toBe(true)
        expect(preset.stages.every(stage => Number.isInteger(stage.target) && stage.target >= 0 && stage.target <= maxCustomUsers)).toBe(true)
    }
})

test('custom stages become gradual k6 ramps with input duration preserved', () => {
    expect(totalDurationSeconds(defaultCustomStages)).toBe(30)
    const stages = toK6Stages(defaultCustomStages)
    expect(stages).toHaveLength(defaultCustomStages.length * customCurveSteps)
    expect(stages.slice(0, customCurveSteps).map(stage => stage.duration)).toEqual(Array(customCurveSteps).fill('1250ms'))
    expect(stages.slice(0, customCurveSteps).map(stage => stage.target)).toEqual([0, 0, 0, 1, 1, 1, 1, 1])
    expect(stages.slice(customCurveSteps, customCurveSteps * 2).at(-1)?.target).toBe(5)
    expect(stages.slice(customCurveSteps * 2).at(-1)?.target).toBe(1)
    expect(stages.every(stage => Number.isInteger(stage.target) && stage.target >= 0 && stage.target <= maxCustomUsers)).toBe(true)
    expect(stages.reduce((total, stage) => total + Number.parseInt(stage.duration, 10), 0) / 1_000).toBe(30)
})

test('custom traffic can reach the 2,000-user limit', () => {
    expect(toK6Stages([{ durationSeconds: 1, target: maxCustomUsers }]).at(-1)?.target).toBe(2_000)
})
