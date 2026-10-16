import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

export function readBrowserClientSource(root: string) {
    const directory = path.join(root, 'src/app/browser')
    const files: string[] = []
    const visit = (current: string) => {
        for (const entry of readdirSync(current, { withFileTypes: true })) {
            const entryPath = path.join(current, entry.name)
            if (entry.isDirectory() && entry.name !== 'report') visit(entryPath)
            else if (/\.tsx?$/.test(entry.name)) files.push(entryPath)
        }
    }
    visit(directory)
    return files.sort().map(file => readFileSync(file, 'utf8')).join('\n')
}
