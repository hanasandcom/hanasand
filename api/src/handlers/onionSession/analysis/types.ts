export type SandboxThreatAssociation = {
    name: string
    category: 'actor' | 'malware' | 'ransomware' | 'tool' | 'campaign'
    confidence: 'high' | 'medium' | 'low'
    evidence: string
    source: 'rendered_page' | 'tool_context' | 'decoded_script'
}

export type InspectedSandboxScript = {
    id: string
    src: string
    inlineBytes: number
    obfuscationScore: number
    reasons: string[]
    sample: string
    sha256: string
}
