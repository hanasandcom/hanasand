'use client'

export type AiToolCall = {
    action: 'read_share' | 'update_share' | 'http_request' | 'browser_task' | 'scaffold_nextjs_docker' | 'create_vm' | 'create_project' | 'run_terminal_command'
    shareId?: string
    path?: string
    content?: string
    url?: string
    method?: string
    headers?: Record<string, string>
    body?: string
    projectName?: string
    vmName?: string
    command?: string
    timeoutMs?: number
    captureScreenshot?: boolean
    projectFiles?: Array<{ path: string, content: string }>
}
