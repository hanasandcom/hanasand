export type ProviderCaptureEnvelope = {
    id: string
    name: string
    url: string
    capturedAt: string
    target: string
}

export type ProviderCaptureDetails = {
    title?: string
    image?: string | null
    evidence?: unknown
    toolAnalysis?: unknown
    webcrackLoad?: unknown
    deobfuscatedCode?: string
    error?: string
}

export function providerCaptureMessage(
    sessionId: string,
    envelope: ProviderCaptureEnvelope,
    details: ProviderCaptureDetails = {},
) {
    return { type: 'tool_capture', sessionId, ...envelope, ...details }
}

export type ProviderProfileCaptureDependencies = {
    state: import('./sessionState.ts').SessionState
    sessionId: string
    isCurrentRun: (generation: number) => boolean
    send: (payload: Record<string, unknown>) => void
    trace: (event: string, detail?: Record<string, unknown>) => void
    cleanRemoteTabId: (value: unknown) => string
    webCrackTasks: (tasks: import('./providerTypes.ts').SandboxDeobfuscationTask[], generation?: number) => Promise<import('./providerTypes.ts').SandboxDeobfuscationTask[]>
    newBackgroundPage: (context: import('playwright').BrowserContext, generation: number) => Promise<import('playwright').Page>
    watchConsole: (page: import('playwright').Page, generation: number, tabId?: string, name?: string) => void
    focusRemoteTab: (report?: boolean, generation?: number) => Promise<void>
    maybeExtendSuspiciousRun: (evidence?: { verdict?: string } | null, analysis?: import('./providerTypes.ts').SandboxToolAnalysis | null, generation?: number) => void
    persistProviderRunResult: (analysis: import('./providerTypes.ts').SandboxToolAnalysis | undefined, error: string, runId: string | null, generation: number) => void
}
