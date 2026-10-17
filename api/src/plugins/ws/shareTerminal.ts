import fs from 'node:fs'
import path from 'node:path'
import WebSocket from 'ws'
import type { RawData } from 'ws'

type ShareTerminal = {
    label: string
    root: string
    prompt: string
}

export function createShareTerminal(alias: string): ShareTerminal {
    const safeAlias = alias.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 80) || 'share'
    const root = path.resolve(process.env.SHARE_TERMINAL_ROOT || process.cwd())

    fs.mkdirSync(root, { recursive: true })

    return {
        label: safeAlias,
        root,
        prompt: `${safeAlias}:~$ `,
    }
}

export async function handleShareTerminalMessage(connection: WebSocket, terminal: ShareTerminal, message: RawData) {
    const parsed = parseTerminalMessage(message)

    if (!parsed || parsed.type === 'resize') {
        return
    }

    if (parsed.type !== 'terminalInput') {
        return
    }

    const content = parsed.content.replace(/\r/g, '\n')
    const commands = content.split('\n').map(command => command.trim()).filter(Boolean)

    for (const command of commands) {
        const output = await runShareTerminalCommand(terminal, command)
        sendTerminalUpdate(connection, `${command}\r\n${output}${terminal.prompt}`)
    }
}

function parseTerminalMessage(message: RawData) {
    try {
        const parsed = JSON.parse(message.toString()) as { type?: string, content?: string }

        if (typeof parsed.type !== 'string') {
            return null
        }

        return {
            type: parsed.type,
            content: typeof parsed.content === 'string' ? parsed.content : '',
        }
    } catch {
        return {
            type: 'terminalInput',
            content: message.toString(),
        }
    }
}

async function runShareTerminalCommand(terminal: ShareTerminal, command: string) {
    const [program, ...args] = command.split(/\s+/)

    switch (program) {
        case 'pwd':
            return `${terminal.root}\r\n`
        case 'ls':
            return `${await listShareTerminalDirectory(terminal.root, args)}\r\n`
        case 'clear':
            return '\u001Bc'
        case 'help':
            return 'Available commands: pwd, ls, clear, help\r\n'
        default:
            return `${program}: command is not available in this browser terminal\r\n`
    }
}

async function listShareTerminalDirectory(root: string, args: string[]) {
    const visibleArgs = args.filter(arg => !arg.startsWith('-'))
    const target = visibleArgs[0] ? path.resolve(root, visibleArgs[0]) : root

    if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
        return 'Cannot list paths outside this workspace.'
    }

    try {
        const entries = await fs.promises.readdir(target, { withFileTypes: true })
        return entries
            .map(entry => `${entry.name}${entry.isDirectory() ? '/' : ''}`)
            .sort((a, b) => a.localeCompare(b))
            .join('  ') || '.'
    } catch (error) {
        return error instanceof Error ? error.message : String(error)
    }
}

export function sendTerminalUpdate(connection: WebSocket, content: string) {
    if (connection.readyState !== WebSocket.OPEN) {
        return
    }

    connection.send(JSON.stringify({
        type: 'update',
        content,
        participants: 1,
    }))
}
