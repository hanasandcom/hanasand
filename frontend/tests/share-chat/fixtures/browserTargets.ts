export type AppStory = { id: number; prompt: string; expected: string }

export const shareBrowserEvidenceStories: AppStory[] = [
    { id: 1021, prompt: 'does this look live or am i kidding myself', expected: 'live-proof' },
    { id: 1025, prompt: 'phone users complain, dont just lint', expected: 'mobile-proof' },
]
export const shareEvidenceTargetStories: AppStory[] = [
    { id: 1041, prompt: 'look at the actual page, not a sample site', expected: 'actual-page' },
    { id: 1046, prompt: 'do not hallucinate the preview url', expected: 'no-hallucinated-url' },
]
export const visibleProofTargetStories: AppStory[] = [
    { id: 1061, prompt: 'wait, what page are you checking', expected: 'visible-target' },
    { id: 1068, prompt: 'founder is worried about hallucinated browser checks', expected: 'founder-proof-target' },
]
export const evidenceSummaryStories: AppStory[] = [
    { id: 1081, prompt: 'looks broken, show me fast', expected: 'broken-fast-proof' },
    { id: 1086, prompt: 'agency client wants screenshot status visible', expected: 'agency-screenshot-state' },
]
