import type { SandboxThreatAssociation } from './types.ts'

export const THREAT_ASSOCIATION_TERMS: Array<{ name: string; category: SandboxThreatAssociation['category']; pattern: RegExp; context?: RegExp }> = [
    { name: 'LockBit', category: 'ransomware', pattern: /\block\s*bit\b/i },
    { name: 'ALPHV / BlackCat', category: 'ransomware', pattern: /\b(?:alphv|black\s*cat)\b/i },
    { name: 'Clop', category: 'ransomware', pattern: /\bcl0?p\b/i },
    { name: 'Akira', category: 'ransomware', pattern: /\bakira\b/i },
    { name: 'Black Basta', category: 'ransomware', pattern: /\bblack\s*basta\b/i },
    { name: 'Lazarus', category: 'actor', pattern: /\blazarus\b/i },
    { name: 'APT29 / Cozy Bear', category: 'actor', pattern: /\b(?:apt29|cozy\s*bear)\b/i },
    { name: 'APT28 / Fancy Bear', category: 'actor', pattern: /\b(?:apt28|fancy\s*bear)\b/i },
    { name: 'Scattered Spider', category: 'actor', pattern: /\bscattered\s*spider\b/i },
    { name: 'FIN7', category: 'actor', pattern: /\bfin7\b/i },
    { name: 'TA505', category: 'actor', pattern: /\bta505\b/i },
    { name: 'QakBot', category: 'malware', pattern: /\b(?:qakbot|qbot)\b/i },
    { name: 'Emotet', category: 'malware', pattern: /\bemotet\b/i },
    { name: 'TrickBot', category: 'malware', pattern: /\btrickbot\b/i },
    { name: 'IcedID', category: 'malware', pattern: /\bicedid\b/i },
    { name: 'Cobalt Strike', category: 'tool', pattern: /\bcobalt\s*strike\b/i },
    { name: 'SocGholish', category: 'malware', pattern: /\bsocgholish\b/i },
    { name: 'Lumma', category: 'malware', pattern: /\blumma\b/i },
    { name: 'RedLine', category: 'malware', pattern: /\bred\s*line\b/i },
    { name: 'AsyncRAT', category: 'malware', pattern: /\basync\s*rat\b/i },
    { name: 'Agent Tesla', category: 'malware', pattern: /\bagent\s*tesla\b/i },
    { name: 'FormBook', category: 'malware', pattern: /\bformbook\b/i },
    { name: 'Vidar', category: 'malware', pattern: /\bvidar\b/i, context: /\b(?:vidar\s+(?:stealer|malware|payload|c2|ioc|infection)|(?:stealer|malware|payload|c2|ioc|infection)\s+vidar)\b/i },
    { name: 'SmokeLoader', category: 'malware', pattern: /\bsmoke\s*loader\b/i },
    { name: 'DarkGate', category: 'malware', pattern: /\bdarkgate\b/i },
    { name: 'Remcos', category: 'malware', pattern: /\bremcos\b/i },
]

export function extractThreatAssociations(value: string, source: SandboxThreatAssociation['source']) {
    const normalized = value.replace(/\s+/g, ' ')
    const found: SandboxThreatAssociation[] = []
    for (const term of THREAT_ASSOCIATION_TERMS) {
        const match = term.pattern.exec(normalized)
        if (!match || match.index === undefined) continue
        const evidence = evidenceWindow(normalized, match.index, match[0].length)
        const hasThreatContext = term.context ? term.context.test(evidence) : /\b(?:attributed|associated|linked|campaign|operator|ransomware|malware|detected|family|actor)\b/i.test(evidence)
        if (!hasThreatContext && source !== 'decoded_script') continue
        found.push({ name: term.name, category: term.category, confidence: hasThreatContext ? 'high' : 'low', evidence, source })
    }
    const seen = new Set<string>()
    return found.filter(item => {
        const key = `${item.name}:${item.category}:${item.source}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
    }).slice(0, 12)
}

function evidenceWindow(value: string, index: number, length: number) {
    return value.slice(Math.max(0, index - 120), Math.min(value.length, index + length + 120))
        .replace(/\s+/g, ' ').trim().slice(0, 260)
}
