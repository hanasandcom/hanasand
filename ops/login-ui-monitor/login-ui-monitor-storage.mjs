import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export async function readState(statePath) {
    try {
        return JSON.parse(await readFile(statePath, 'utf8'))
    } catch {
        return {}
    }
}

export async function writeState(statePath, state) {
    await mkdir(dirname(statePath), { recursive: true })
    await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`)
}
