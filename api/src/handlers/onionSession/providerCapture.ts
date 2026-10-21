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
    sessionId: string
    isCurrentRun: (generation: number) => boolean
    send: (payload: Record<string, unknown>) => void
    webCrackTasks: (tasks: import('./providerTypes.ts').SandboxDeobfuscationTask[], generation?: number) => Promise<import('./providerTypes.ts').SandboxDeobfuscationTask[]>
    newProviderPage: (generation: number) => Promise<{ page: import('playwright').Page; close: () => Promise<void> }>
    watchConsole: (page: import('playwright').Page, generation: number, tabId?: string, name?: string) => void
    maybeExtendSuspiciousRun: (evidence?: { verdict?: string } | null, analysis?: import('./providerTypes.ts').SandboxToolAnalysis | null, generation?: number) => void
    persistProviderRunResult: (analysis: import('./providerTypes.ts').SandboxToolAnalysis | undefined, error: string, runId: string | null, generation: number) => void
}
