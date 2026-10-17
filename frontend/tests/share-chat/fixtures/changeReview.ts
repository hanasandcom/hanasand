export type AppStory = { id: number; prompt: string; expected: string }

export const pendingCheckpointStories: AppStory[] = [
    { id: 1181, prompt: 'dont lose the edit if I type another thing', expected: 'pending-checkpoint' },
    { id: 1198, prompt: 'designer rejects the draft and wants another', expected: 'designer-discard-draft' },
]
export const pendingSummaryStories: AppStory[] = [
    { id: 1201, prompt: 'what changed, dont make me read code first', expected: 'change-summary' },
    { id: 1204, prompt: 'corporate reviewer needs line counts', expected: 'corporate-line-counts' },
]
export const deploymentDiagnosticStories: AppStory[] = [
    { id: 1221, prompt: 'vercel build failed but logs are missing', expected: 'missing-build-logs' },
    { id: 1236, prompt: 'compliance says dont expose secrets in logs', expected: 'compliance-secret-logs' },
]
export const costControlStories: AppStory[] = [
    { id: 1241, prompt: 'v0 made it worse and spent my credits', expected: 'v0-made-worse' },
    { id: 1242, prompt: 'dont rewrite the whole site for a button fix', expected: 'no-whole-site-rewrite' },
]
