import type { summarizeDeobfuscationTask } from './analysis.ts'
import type { analyzeToolEvidence } from './providerAnalysis.ts'

export type SandboxDeobfuscationTask = ReturnType<typeof summarizeDeobfuscationTask>
export type SandboxToolAnalysis = ReturnType<typeof analyzeToolEvidence>
export type WebCrackLoadResult = {
    loaded: boolean
    scriptId?: string
    source?: string
    sampleBytes?: number
    action?: string
    reason?: string
}
