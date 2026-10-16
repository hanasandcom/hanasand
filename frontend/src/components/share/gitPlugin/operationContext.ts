import type { Dispatch, SetStateAction } from 'react'
import type { GitPluginProps, LanguageStat, StoredGitWorkspace } from './types'

export type GitOperationContext = GitPluginProps & {
    shareRouteId: string
    userId: string | null
    accessToken: string | null
    isSignedIn: boolean
    currentInput: string
    githubToken: string
    autoPullMinutes: number
    commitMessage: string
    selectedPaths: Set<string>
    stored: StoredGitWorkspace | null
    gitStatus: AIGitStatus | null
    setStatus(value: string | null): void
    setError(value: string | null): void
    setPending(value: 'import' | 'pull' | 'status' | 'commit' | 'push' | null): void
    setStored: Dispatch<SetStateAction<StoredGitWorkspace | null>>
    setGitStatus(value: AIGitStatus | null): void
    setSelectedPaths: Dispatch<SetStateAction<Set<string>>>
    setCommitMessage(value: string): void
    setGitHubToken(value: string): void
    setSyncProgress(value: AISyncProgress | null): void
    setSyncStartedAt(value: number | null): void
    setLanguageOverview(value: LanguageStat[]): void
}
