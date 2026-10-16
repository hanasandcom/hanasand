import { readdirSync, statSync } from 'node:fs'
import path from 'node:path'

export function collectFiles(root) {
    const files = []
    for (const entry of readdirSync(root)) {
        const absolute = path.join(root, entry)
        const stat = statSync(absolute)
        if (stat.isDirectory()) files.push(...collectFiles(absolute))
        else if (/\.(ts|tsx)$/.test(entry)) files.push(absolute)
    }
    return files.sort((a, b) => a.localeCompare(b))
}
