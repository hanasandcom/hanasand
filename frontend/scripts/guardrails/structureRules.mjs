import fs from 'node:fs/promises'
import path from 'node:path'
import { errors } from './context.mjs'
import { lineAndColumn, relative } from './sourceUtils.mjs'

const bannedStaticExposureQueuePatterns = [
    /\bconst\s+feedRows\s*=/,
    /\bNtd Apparel\b/i,
    /\bAerospace & Advanced Composites\b/i,
    /\bIrec Sas\b/i,
    /\b2026-06-2[67]\b/,
]
const bannedRuntimeDwmDemoPatterns = [
    /\b2026-06-27T\b/,
    />Live<\/span>/,
]
const bannedLegacyBackgroundPatterns = [
    { pattern: /\bBackgroundSketches\b/, label: 'old sketch background component' },
    { pattern: /\bbackground-sketch\b/, label: 'old line-art sketch background class' },
    { pattern: /\blumbermill-sketch\b/, label: 'old line-art sketch background class' },
    { pattern: /\bfuture-cabin-sketch\b/, label: 'old line-art sketch background class' },
    { pattern: /--grid-line\b/, label: 'old rectangular atmosphere grid token' },
    { pattern: /linear-gradient\(var\(--grid-line\)/, label: 'old rectangular atmosphere grid background' },
    { pattern: /linear-gradient\(90deg,\s*var\(--grid-line\)/, label: 'old rectangular atmosphere grid background' },
]
const bannedAiMetricsBlockerPatterns = [
    /\bLaunch blockers\b/i,
    /\bneeds proof\b/i,
    /\bneeds work\b/i,
    /\bThe product is on the right path\b/i,
    /\bNext:\s*run more jobs\b/i,
]
export function validateMetadata(filePath, text) {
    if (!/metadataBase:\s*new URL\(['"]https:\/\/hanasand\.com['"]\)/.test(text)) {
        errors.push(`${relative(filePath)}: root metadata must define metadataBase: new URL('https://hanasand.com').`)
    }

    if (!/alternates:\s*\{\s*canonical:\s*['"]\/['"]\s*,?\s*\}/s.test(text)) {
        errors.push(`${relative(filePath)}: root metadata must define alternates.canonical = '/'.`)
    }
}

export function validateStaticExposureQueue(filePath, source, text) {
    if (!filePath.endsWith(path.join('src', 'app', 'page.tsx'))) return
    for (const pattern of bannedStaticExposureQueuePatterns) {
        const match = text.match(pattern)
        if (!match || match.index === undefined) continue
        const position = source.getLineAndCharacterOfPosition(match.index)
        errors.push(`${relative(filePath)}:${position.line + 1}:${position.character + 1}: homepage exposure queue must be API-backed; remove static live claim data matching ${pattern}.`)
    }
}

export function validateRuntimeDwmDemo(filePath, source, text) {
    const relativePath = relative(filePath)
    if (relativePath !== path.join('src', 'app', 'solutions', 'dwm', 'pageClient.tsx')
        && relativePath !== path.join('src', 'utils', 'dwm', 'product.ts')) return
    for (const pattern of bannedRuntimeDwmDemoPatterns) {
        const match = text.match(pattern)
        if (!match || match.index === undefined) continue
        const position = source.getLineAndCharacterOfPosition(match.index)
        errors.push(`${relativePath}:${position.line + 1}:${position.character + 1}: DWM runtime demo must not present stale fixed dates or fake live labels matching ${pattern}.`)
    }
}

export function validateAiMetricsCopy(filePath, source, text) {
    const relativePath = relative(filePath)
    if (relativePath !== path.join('src', 'app', 'dashboard', 'system', 'ai', 'pageClient.tsx')) return
    for (const pattern of bannedAiMetricsBlockerPatterns) {
        const match = text.match(pattern)
        if (!match || match.index === undefined) continue
        const position = source.getLineAndCharacterOfPosition(match.index)
        errors.push(`${relativePath}:${position.line + 1}:${position.character + 1}: AI Metrics must show operational evidence or exact internal action gates, not launch-blocker/prompt-answer copy matching ${pattern}.`)
    }
}

export async function validateLegacyBackgroundPatterns(filePath) {
    const text = await fs.readFile(filePath, 'utf8')
    for (const { pattern, label } of bannedLegacyBackgroundPatterns) {
        const match = text.match(pattern)
        if (!match || match.index === undefined) continue
        const position = lineAndColumn(text, match.index)
        errors.push(`${relative(filePath)}:${position.line}:${position.column}: ${label} is banned. Use the blue dotted site atmosphere or the clean loading spinner surface instead.`)
    }
}
