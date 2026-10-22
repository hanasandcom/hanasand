export type CustomTrafficStage = { durationSeconds: number, target: number }
export type K6Stage = { duration: string, target: number }

export const scenarioPresets = [
    { id: 'baseline', label: 'Baseline', detail: 'Steady, single-user traffic.', stages: [{ duration: '30s', target: 1 }], timeout: 30000 },
    { id: 'ramp', label: 'Ramp', detail: 'Build traffic up, then back down.', stages: [{ duration: '30s', target: 5 }, { duration: '1m', target: 20 }, { duration: '30s', target: 0 }], timeout: 45000 },
    { id: 'spike', label: 'Spike', detail: 'A short burst of heavier traffic.', stages: [{ duration: '15s', target: 5 }, { duration: '20s', target: 40 }, { duration: '25s', target: 0 }], timeout: 60000 },
    { id: 'custom', label: 'Custom', detail: 'Set your own traffic stages.', stages: [], timeout: 30000 },
] satisfies Array<{ id: string, label: string, detail: string, stages: K6Stage[], timeout: number }>

export const defaultCustomStages: CustomTrafficStage[] = [
    { durationSeconds: 10, target: 1 },
    { durationSeconds: 10, target: 5 },
    { durationSeconds: 10, target: 1 },
]

export const maxCustomStages = 8
export const maxCustomDurationSeconds = 600

export function toK6Stages(stages: CustomTrafficStage[]): K6Stage[] {
    return stages.map(stage => ({ duration: `${stage.durationSeconds}s`, target: stage.target }))
}

export function totalDurationSeconds(stages: CustomTrafficStage[]) {
    return stages.reduce((total, stage) => total + stage.durationSeconds, 0)
}
