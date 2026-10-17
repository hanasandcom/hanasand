import { createHash } from 'node:crypto'
import type { InspectedSandboxScript } from './types.ts'
import { extractIndicators } from './indicators.ts'
import { extractThreatAssociations } from './threatAssociations.ts'

const MAX_SCRIPT_SAMPLE = 3200

export function summarizeDeobfuscationTask(script: InspectedSandboxScript) {
    const decoded = decodeScriptSample(script.sample)
    const joined = [script.sample, decoded.preview].join('\n')
    const indicators = extractIndicators(joined)
    const threatAssociations = extractThreatAssociations(joined, 'decoded_script')
    const highConfidenceThreat = threatAssociations.some(item => item.confidence !== 'low')
    const hasDecodedNetwork = decoded.preview && (indicators.ips.length > 0 || indicators.urls.length > 0)
    const hasExecutablePayload = /\b(?:powershell|cmd\.exe|wscript|mshta|rundll32|regsvr32|\.exe|\.dll|payload|dropper|stealer|seed phrase|credential)\b/i.test(joined)
    const hasSuspiciousRedirect = /(?:document\.write|location\.href|window\.location)/i.test(joined)
        && /https?:\/\//i.test(joined)
        && script.reasons.some(reason => reason !== 'dynamic execution')
    const reasons = [
        hasDecodedNetwork ? 'decoded network indicators' : '',
        hasSuspiciousRedirect ? 'decoded redirect behavior' : '',
        hasExecutablePayload ? 'payload or credential-theft language' : '',
        highConfidenceThreat ? 'threat-context match' : '',
    ].filter(Boolean)
    return {
        scriptId: script.id, source: script.src || 'inline', webcrackReady: Boolean(script.sample), sample: script.sample,
        sha256: script.sha256, decodedPreview: decoded.preview, decodedTransforms: decoded.transforms, indicators, threatAssociations,
        assessment: reasons.length ? 'suspicious' : 'unknown',
        summary: reasons.length ? `Decoded script remains suspicious: ${reasons.join(', ')}.` : 'Decoded sample did not expose a high-confidence payload in the extracted window.',
    }
}

export function isActionableObfuscatedScript(script: InspectedSandboxScript) {
    if (!script.sample || script.sample.length < 120) return false
    const strongReasons = script.reasons.filter(reason => reason !== 'dynamic execution')
    if (strongReasons.length >= 2 && script.obfuscationScore >= 5) return true
    const decoded = decodeScriptSample(script.sample)
    return script.reasons.includes('dynamic execution') && strongReasons.length >= 2 && extractIndicators(decoded.preview).urls.length > 0
}

export function decodeScriptSample(sample: string) {
    const transforms: string[] = []
    const decoded: string[] = []
    for (const match of sample.matchAll(/['"`]([A-Za-z0-9+/]{40,}={0,2})['"`]/g)) {
        try {
            const output = Buffer.from(match[1], 'base64').toString('utf8')
            if (looksPrintable(output)) {
                transforms.push('base64 string')
                decoded.push(output)
            }
        } catch {
            // Obfuscated pages often include invalid base64 candidates as decoys.
        }
    }
    const unescaped = sample
        .replace(/\\x([0-9a-f]{2})/gi, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)))
        .replace(/\\u([0-9a-f]{4})/gi, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)))
    if (unescaped !== sample) {
        transforms.push('hex/unicode escapes')
        decoded.push(unescaped)
    }
    return { transforms: Array.from(new Set(transforms)), preview: decoded.join('\n').replace(/\s+/g, ' ').trim().slice(0, 1200) }
}

export function inspectScript(script: { src: string; inline: string }, index: number): InspectedSandboxScript {
    const value = script.inline || ''
    const longStringCount = (value.match(/["'`][A-Za-z0-9+/=]{80,}["'`]/g) || []).length
    const evalCount = (value.match(/\b(eval|Function|setTimeout|setInterval)\s*\(/g) || []).length
    const atobCount = (value.match(/\b(atob|btoa|unescape|decodeURIComponent)\s*\(/g) || []).length
    const hexEscapeCount = (value.match(/\\x[0-9a-f]{2}|\\u[0-9a-f]{4}/gi) || []).length
    const charCodeCount = (value.match(/fromCharCode|charCodeAt/g) || []).length
    const entropyHint = value.length > 600 ? Math.min(3, Math.floor(uniqueRatio(value) * 4)) : 0
    const obfuscationScore = longStringCount + evalCount + atobCount + Math.min(3, Math.floor(hexEscapeCount / 8)) + charCodeCount + entropyHint
    return {
        id: `script_${index + 1}`, src: script.src, inlineBytes: value.length, obfuscationScore,
        reasons: [longStringCount ? 'long encoded strings' : '', evalCount ? 'dynamic execution' : '', atobCount ? 'base64/URI decoding' : '', hexEscapeCount ? 'hex/unicode escapes' : '', charCodeCount ? 'character-code construction' : ''].filter(Boolean),
        sample: value ? value.slice(0, MAX_SCRIPT_SAMPLE) : '', sha256: createHash('sha256').update(script.src || value).digest('hex'),
    }
}

function looksPrintable(value: string) {
    const printable = Array.from(value).filter(character => {
        const code = character.charCodeAt(0)
        return code === 9 || code === 10 || code === 13 || (code >= 32 && code <= 126)
    }).length
    return printable >= 20 && printable / Math.max(1, value.length) > 0.75
}

function uniqueRatio(value: string) {
    return value ? new Set(value).size / value.length : 0
}
