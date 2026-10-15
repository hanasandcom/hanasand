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
