import type { TerminalCredentials, TerminalLifecycle } from './terminalTypes'

export function statusFromTerminalUpdate(raw: string) {
    try {
        const parsed = JSON.parse(raw) as { content?: string, code?: unknown }
        if (parsed.code !== undefined || typeof parsed.content !== 'string') return null
        const cleaned = parsed.content
            .replace(/\r/g, '\n')
            .split('\n')
            .map(line => line.replace(/^\[[+\-✓]\]\s*/, '').trim())
            .filter(line => !isBenignTerminalNoise(line))
            .filter(Boolean)
            .at(-1)
        return cleaned || null
    } catch {
        return raw.trim() || null
    }
}

export function lifecycleFromTerminalUpdate(raw: string): TerminalLifecycle | null {
    const content = terminalContent(raw).toLowerCase()
    if (!content) return null
    if (content.includes('shutting down') || content.includes('shutdown')) return 'shutting_down'
    if (content.includes('idle')) return 'idle'
    if (isWakingMessage(content)) return 'waking'
    if (content.includes('preparing ssh access') || content.includes('preparing terminal')) return 'preparing'
    if (content.includes('terminal ready') || content.includes('vm agent is ready')) return 'ready'
    if (content.includes('[!]') || content.includes('error')) return 'error'
    return null
}

function isWakingMessage(content: string) {
    return content.includes('vm does not exist')
        || content.includes('starting existing vm')
        || content.includes('waiting for vm agent')
        || content.includes('claiming warm vm')
        || content.includes('opening terminal')
        || content.includes('this may take some time')
}

function terminalContent(raw: string) {
    try {
        const parsed = JSON.parse(raw) as { content?: string }
        return typeof parsed.content === 'string' ? cleanTerminalContent(parsed.content) : ''
    } catch {
        return cleanTerminalContent(raw)
    }
}

function cleanTerminalContent(content: string) {
    return content
        .replace(/\r/g, '\n')
        .split('\n')
        .filter(line => !isBenignTerminalNoise(line.trim()))
        .join('\n')
}

function isBenignTerminalNoise(line: string) {
    return line.includes('sudo: unable to resolve host')
}

export function isTerminalCredentials(value: unknown): value is TerminalCredentials {
    if (!value || typeof value !== 'object') return false
    const candidate = value as Partial<TerminalCredentials>
    return typeof candidate.username === 'string'
        && typeof candidate.password === 'string'
        && typeof candidate.sshCommand === 'string'
        && typeof candidate.domain === 'string'
}
