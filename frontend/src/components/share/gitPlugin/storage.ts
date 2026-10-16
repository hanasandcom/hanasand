import type { LanguageStat, StoredGitWorkspace } from './types'

export const autoPullOptions = [
    { label: 'Off', value: 0 },
    { label: '5 min', value: 5 },
    { label: '15 min', value: 15 },
    { label: '30 min', value: 30 },
    { label: '60 min', value: 60 },
]

const storagePrefix = 'hanasand.share.git.'
const autoPullStoragePrefix = 'hanasand.share.git.autopull.'

export function readAutoPullMinutes(shareId: string) {
    if (typeof window === 'undefined') return 0
    const storedMinutes = Number(window.localStorage.getItem(`${autoPullStoragePrefix}${shareId}`) || '0')
    return autoPullOptions.some(option => option.value === storedMinutes) ? storedMinutes : 0
}

export function rememberAutoPullMinutes(shareId: string, minutes: number) {
    if (typeof window !== 'undefined') {
        window.localStorage.setItem(`${autoPullStoragePrefix}${shareId}`, String(minutes))
    }
}

export function readStoredGitWorkspace(shareId: string): StoredGitWorkspace | null {
    if (typeof window === 'undefined') return null

    try {
        const raw = window.localStorage.getItem(`${storagePrefix}${shareId}`)
        if (!raw) return null
        const parsed = JSON.parse(raw) as Partial<StoredGitWorkspace>
        if (!parsed.input || !parsed.fullName || !parsed.branch) return null
        return {
            input: parsed.input,
            fullName: parsed.fullName,
            branch: parsed.branch,
            sourcePath: parsed.sourcePath || '',
            updatedAt: parsed.updatedAt || '',
            lastSyncedAt: parsed.lastSyncedAt || parsed.updatedAt || '',
            autoPullMinutes: typeof parsed.autoPullMinutes === 'number' ? parsed.autoPullMinutes : undefined,
        }
    } catch {
        return null
    }
}

export function rememberGitWorkspace(shareId: string, workspace: StoredGitWorkspace) {
    if (typeof window !== 'undefined') {
        window.localStorage.setItem(`${storagePrefix}${shareId}`, JSON.stringify(workspace))
    }
}

export function buildLanguageOverview(files: AIImportedRepoFile[]): LanguageStat[] {
    const counts = new Map<string, number>()
    for (const file of files) {
        const language = languageForPath(file.path)
        counts.set(language, (counts.get(language) || 0) + 1)
    }

    const total = files.length || 1
    return [...counts.entries()]
        .map(([language, files]) => ({ language, files, percentage: Math.round((files / total) * 100) }))
        .sort((left, right) => right.files - left.files)
        .slice(0, 8)
}

function languageForPath(filePath: string) {
    const name = filePath.split('/').pop()?.toLowerCase() || filePath.toLowerCase()
    if (name === 'dockerfile') return 'Dockerfile'
    if (name === 'makefile') return 'Makefile'
    if (name.endsWith('.ts') || name.endsWith('.tsx')) return 'TypeScript'
    if (name.endsWith('.js') || name.endsWith('.jsx') || name.endsWith('.mjs') || name.endsWith('.cjs')) return 'JavaScript'
    if (name.endsWith('.css') || name.endsWith('.scss') || name.endsWith('.sass')) return 'CSS'
    if (name.endsWith('.html')) return 'HTML'
    if (name.endsWith('.json')) return 'JSON'
    if (name.endsWith('.md') || name.endsWith('.mdx')) return 'Markdown'
    if (name.endsWith('.swift')) return 'Swift'
    if (name.endsWith('.py')) return 'Python'
    if (name.endsWith('.go')) return 'Go'
    if (name.endsWith('.rs')) return 'Rust'
    if (name.endsWith('.java') || name.endsWith('.kt') || name.endsWith('.kts')) return 'JVM'
    if (name.endsWith('.yml') || name.endsWith('.yaml')) return 'YAML'
    if (name.endsWith('.sql')) return 'SQL'
    if (name.endsWith('.sh') || name.endsWith('.zsh') || name.endsWith('.bash')) return 'Shell'
    return 'Other'
}

export function formatEta(progress: AISyncProgress, startedAt: number | null) {
    if (!startedAt || progress.syncedFiles <= 0 || progress.totalFiles <= progress.syncedFiles) {
        return progress.totalFiles <= progress.syncedFiles && progress.totalFiles > 0 ? 'Done' : 'ETA calculating'
    }

    const elapsedSeconds = Math.max((Date.now() - startedAt) / 1000, 0.1)
    const secondsPerFile = elapsedSeconds / progress.syncedFiles
    const remainingSeconds = Math.max(0, Math.round(secondsPerFile * (progress.totalFiles - progress.syncedFiles)))
    if (remainingSeconds < 60) return `${remainingSeconds}s left`

    const minutes = Math.floor(remainingSeconds / 60)
    const seconds = remainingSeconds % 60
    return `${minutes}m ${seconds}s left`
}

export function formatSyncTime(value?: string) {
    if (!value) return 'never'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return 'never'

    return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
