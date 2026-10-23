import type { SandboxThreatAssociation } from './session'

export type SandboxEvidence = {
    url?: string
    textExcerpt?: string
    sourceCode?: string
    sourceUrls?: string[]
    verdict?: string
    confidence?: number
    reasons?: string[]
    comments?: string[]
    communityComments?: string[]
    indicators?: {
        domains?: string[]
        ips?: string[]
        urls?: string[]
    }
    forms?: Array<{ action?: string; method?: string; sensitiveInputCount?: number; inputCount?: number }>
    scripts?: Array<{ id?: string; src?: string; inlineBytes?: number; obfuscationScore?: number; reasons?: string[]; sample?: string; sha256?: string }>
    obfuscatedScripts?: Array<{ id?: string; src?: string; inlineBytes?: number; obfuscationScore?: number; reasons?: string[]; sample?: string; sha256?: string }>
    threatAssociations?: SandboxThreatAssociation[]
    deobfuscationTasks?: Array<{
        scriptId?: string
        source?: string
        webcrackReady?: boolean
        sample?: string
        sha256?: string
        decodedPreview?: string
        decodedTransforms?: string[]
        indicators?: { domains?: string[]; ips?: string[]; urls?: string[] }
        threatAssociations?: SandboxThreatAssociation[]
        assessment?: string
        summary?: string
    }>
}
