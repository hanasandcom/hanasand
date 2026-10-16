export type TerminalCredentials = {
    username: string
    password: string
    sshCommand: string
    domain: string
}

export type TerminalLifecycle = 'closed' | 'connecting' | 'waking' | 'preparing' | 'ready' | 'idle' | 'shutting_down' | 'error'

export type TerminalTransport = {
    socket: { current: WebSocket | null }
    queuedMessages: { current: string[] }
    reconnectTimeout: { current: ReturnType<typeof setTimeout> | null }
    lastResize: { current: { cols: number, rows: number } | null }
    session: { current: string | null }
}
