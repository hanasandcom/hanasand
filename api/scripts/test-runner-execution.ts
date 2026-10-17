import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type { TestTask } from './test-runner-tasks.ts'

const bun = process.execPath
const scriptDir = path.dirname(fileURLToPath(import.meta.url))

export async function runTask(task: TestTask) {
    console.log(`\n[api:test] ${task.title}`)
    if (task.guardProductionSmoke) {
        await runCommand({ ...task, id: `${task.id}:guard`, command: [bun, 'scripts/guard-production-smoke.mjs'] })
    }

    if (task.inlineModule) {
        await import(pathToFileURL(path.join(scriptDir, task.inlineModule)).href)
        return
    }

    await runCommand(task)
}

function runCommand(task: TestTask) {
    return new Promise<void>((resolve, reject) => {
        const [command, ...args] = task.command
        const child = spawn(command, args, {
            cwd: process.cwd(),
            env: { ...process.env, ...(task.env || {}) },
            stdio: 'inherit',
        })

        child.on('error', reject)
        child.on('exit', code => {
            if (code === 0) {
                resolve()
                return
            }
            reject(new Error(`${task.id} failed with exit code ${code}`))
        })
    })
}
