export type AppStory = { id: number; prompt: string; expected: string }

export const runSummaryStories: AppStory[] = [
    { id: 1101, prompt: 'did it actually do anything fast', expected: 'fast-run-proof' },
    { id: 1112, prompt: 'compliance needs retry state if failed', expected: 'compliance-retry-state' },
]
export const browserRetryStories: AppStory[] = [
    { id: 1121, prompt: 'browser proof failed but dont lie', expected: 'browser-failed-honestly' },
    { id: 1138, prompt: 'designer says no green check if proof failed', expected: 'designer-no-green-check' },
]
export const proofGateStories: AppStory[] = [
    { id: 1141, prompt: 'dont let me apply if proof failed', expected: 'apply-blocked-after-proof-fail' },
    { id: 1151, prompt: 'mobile proof failed, require retry first', expected: 'mobile-retry-first' },
]
export const proofRecoveryStories: AppStory[] = [
    { id: 1161, prompt: 'the proof failed, now make the retry obvious', expected: 'retry-proof-action' },
    { id: 1173, prompt: 'investor page should not need a second AI answer', expected: 'investor-no-second-answer' },
]
