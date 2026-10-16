import { spawn } from 'node:child_process'
import type { TestTask } from './testTask'

export function runTestTask(task: TestTask) {
    return new Promise<void>((resolve, reject) => {
        console.log(`\n[frontend:test] ${task.title}`)
        const [command, ...args] = task.command
        const child = spawn(command, args, {
            cwd: process.cwd(),
            env: { ...process.env, ...(task.env || {}) },
            stdio: 'inherit',
        })

        child.on('error', reject)
        child.on('exit', (code) => {
            if (code === 0) {
                resolve()
                return
            }
            reject(new Error(`${task.id} failed with exit code ${code}`))
        })
    })
}
