import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const sourceRoot = fileURLToPath(new URL('../src/app/organizations/', import.meta.url))

function readSources(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const target = path.join(directory, entry.name)
        return entry.isDirectory() ? readSources(target) : /\.(?:ts|tsx)$/.test(entry.name) ? [readFileSync(target, 'utf8')] : []
    })
}

export const organizationWorkspaceSource = readSources(sourceRoot).join('\n')
