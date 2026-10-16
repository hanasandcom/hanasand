import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

export async function workbenchSource(root: string) {
    const directory = path.join(root, 'src/app/dashboard/ti/workbench')
    const files: string[] = []
    async function collect(current: string): Promise<void> {
        for (const entry of await readdir(current, { withFileTypes: true })) {
            const file = path.join(current, entry.name)
            if (entry.isDirectory()) await collect(file)
            else if (/\.(ts|tsx)$/.test(entry.name)) files.push(file)
        }
    }
    await collect(directory)
    return (await Promise.all(files.map(file => readFile(file, 'utf8')))).join('\n')
}
