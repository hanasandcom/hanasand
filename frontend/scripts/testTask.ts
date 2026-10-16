export type TestTask = {
    id: string
    title: string
    command: string[]
    env?: Record<string, string>
    requires?: 'server' | 'playwright'
}

export const bun = process.execPath
