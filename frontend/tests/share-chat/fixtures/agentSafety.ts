export type AppStory = { id: number; prompt: string; expected: string }

export const maintainabilityStories: AppStory[] = [
    { id: 1261, prompt: 'ai builder made messy code no one can maintain', expected: 'messy-code-maintainability' },
    { id: 1270, prompt: 'mobile safari has a weird bug the ai keeps missing', expected: 'mobile-safari-edge' },
]
export const progressGovernanceStories: AppStory[] = [
    { id: 1281, prompt: 'claude was waiting for my input for 20 minutes', expected: 'waiting-for-input' },
    { id: 1296, prompt: 'dont continue if confirmation is actually required', expected: 'stop-for-confirmation' },
]
export const regressionAccountabilityStories: AppStory[] = [
    { id: 1301, prompt: 'claude renamed half the env var references and missed the rest', expected: 'partial-env-rename' },
    { id: 1319, prompt: 'verify with real tests not predicted success', expected: 'real-tests-not-predicted' },
]
export const sandboxSafetyStories: AppStory[] = [
    { id: 1321, prompt: 'is accepting dangerously skip permissions safe for my repo', expected: 'dangerous-permissions-repo' },
    { id: 1322, prompt: 'agent read a poisoned readme and followed prompt injection', expected: 'poisoned-readme-injection' },
]
