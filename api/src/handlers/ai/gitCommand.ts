import { spawn } from 'node:child_process'

export function runGit(args: string[], cwd?: string, env?: NodeJS.ProcessEnv, timeoutMs = 120_000) {
    return new Promise<{ stdout: string, stderr: string }>((resolve, reject) => {
        const child = spawn('git', args, {
            cwd,
            stdio: ['ignore', 'pipe', 'pipe'],
            env: {
                ...process.env,
                GIT_TERMINAL_PROMPT: '0',
                ...(env || {}),
            },
        })

        let stdout = ''
        let stderr = ''
        let settled = false

        const timeout = setTimeout(() => {
            if (settled) return
            settled = true
            child.kill('SIGTERM')
            reject(new Error(`git ${args.join(' ')} timed out. Check the repository URL or credentials.`))
        }, timeoutMs)

        child.stdout.on('data', (chunk) => {
            stdout += chunk.toString()
        })
        child.stderr.on('data', (chunk) => {
            stderr += chunk.toString()
        })
        child.on('error', (error) => {
            if (settled) return
            settled = true
            clearTimeout(timeout)
            reject(error)
        })
        child.on('close', (code) => {
            if (settled) return
            settled = true
            clearTimeout(timeout)
            if (code !== 0) {
                reject(new Error(stderr.trim() || `git ${args.join(' ')} failed with code ${code}`))
                return
            }

            resolve({ stdout, stderr })
        })
    })
}
