export function expectedToolCompletionText(content: string): string | null {
    if (content.includes('"action":"scaffold_nextjs_docker"')) {
        const projectName = content.match(/"projectName":"([^"]+)"/)?.[1]
        return projectName ? `Scaffolded a Next.js + Docker workspace for ${projectName}. The workspace is attached and ready for follow-up edits.` : null
    }
    if (content.includes('"action":"create_project"')) {
        const projectName = content.match(/"projectName":"([^"]+)"/)?.[1]
        return projectName ? `Created project workspace for ${projectName}` : null
    }
    if (content.includes('"action":"run_terminal_command"')) {
        const command = content.match(/"command":"([^"]+)"/)?.[1]
        return command ? `Command: ${command}` : null
    }
    if (content.includes('"action":"http_request"')) {
        const url = content.match(/"url":"([^"]+)"/)?.[1]
        return url ? `HTTP GET ${url}` : null
    }
    if (content.includes('"action":"browser_task"')) {
        const url = content.match(/"url":"([^"]+)"/)?.[1]
        return url ? `Tool browser_task executed for URL: ${url}` : null
    }
    return null
}
