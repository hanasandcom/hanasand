import type { TestTask } from './testTask'

export function shouldRunByDefault(task: TestTask, includeServer: boolean, includePlaywright: boolean) {
    if (task.requires === 'server') return includeServer
    if (task.requires === 'playwright') return includePlaywright
    return true
}

export function parseOnly(args: string[]) {
    const ids = new Set<string>()
    for (const arg of args) {
        if (arg.startsWith('--only=')) {
            for (const id of arg.slice('--only='.length).split(',')) {
                if (id.trim()) ids.add(id.trim())
            }
        }
    }
    return ids
}
