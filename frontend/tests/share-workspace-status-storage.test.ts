import { afterEach, expect, test } from 'bun:test'
import { readStoredGitWorkspace } from '../src/components/share/gitPlugin/storage'

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')

function installStorage(values: Record<string, string>) {
    Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: { localStorage: { getItem: (key: string) => values[key] ?? null } },
    })
}

afterEach(() => {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow)
    else Reflect.deleteProperty(globalThis, 'window')
})

test('Git workspace reader returns null for absent, malformed, and incomplete storage', () => {
    installStorage({
        'hanasand.share.git.malformed': '{',
        'hanasand.share.git.incomplete': JSON.stringify({ input: 'repo' }),
    })

    expect(readStoredGitWorkspace('absent')).toBeNull()
    expect(readStoredGitWorkspace('malformed')).toBeNull()
    expect(readStoredGitWorkspace('incomplete')).toBeNull()
})

test('Git workspace reader normalizes optional fields and retains shared plugin metadata', () => {
    installStorage({
        'hanasand.share.git.ready': JSON.stringify({ input: 'org/repo', fullName: 'Org/Repo', branch: 'main', autoPullMinutes: 15 }),
    })

    expect(readStoredGitWorkspace('ready')).toEqual({
        input: 'org/repo', fullName: 'Org/Repo', branch: 'main', sourcePath: '', updatedAt: '', lastSyncedAt: '', autoPullMinutes: 15,
    })
})

test('Git workspace reader is safe during server rendering', () => {
    if (originalWindow) Reflect.deleteProperty(globalThis, 'window')
    expect(readStoredGitWorkspace('server')).toBeNull()
})
