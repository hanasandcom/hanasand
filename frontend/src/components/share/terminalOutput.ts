import type { Terminal } from '@xterm/xterm'

export function writeTerminalChunks(terminal: Terminal, chunks: string[]) {
    chunks.forEach(chunk => {
        const content = parseTerminalContent(chunk)
        if (content) terminal.write(content)
    })
}

export function parseTerminalContent(chunk: string) {
    try {
        const parsed = JSON.parse(chunk) as { content?: string }
        return cleanTerminalOutput(parsed.content || '')
    } catch {
        return cleanTerminalOutput(chunk)
    }
}

function cleanTerminalOutput(content: string) {
    if (!content) return ''

    return content
        .replace(/\r\n/g, '\n')
        .split('\n')
        .filter(line => !isShellStartupNoise(line))
        .join('\r\n')
}

function isShellStartupNoise(line: string) {
    const trimmed = line.trim()
    return trimmed.includes('bash: cannot set terminal process group')
        || trimmed.includes('bash: no job control in this shell')
        || trimmed.includes('sudo: unable to resolve host')
        || trimmed.startsWith('To run a command as administrator')
        || trimmed.startsWith('See "man sudo_root"')
}
