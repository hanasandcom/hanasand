export type GitPluginProps = {
    shareRouteId: string
    share: Share | null
}

export type StoredGitWorkspace = {
    input: string
    fullName: string
    branch: string
    sourcePath: string
    updatedAt: string
    lastSyncedAt?: string
    autoPullMinutes?: number
}

export type LanguageStat = {
    language: string
    files: number
    percentage: number
}

export type PendingGitAction = 'import' | 'pull' | 'status' | 'commit' | 'push' | null

export type GitPluginState = {
    input: string
    setInput(value: string): void
    githubToken: string
    setGitHubToken(value: string): void
    status: string | null
    error: string | null
    pending: PendingGitAction
    stored: StoredGitWorkspace | null
    gitStatus: AIGitStatus | null
    selectedPaths: Set<string>
    commitMessage: string
    setCommitMessage(value: string): void
    autoPullMinutes: number
    setAutoPullMinutes(value: number): void
    syncProgress: AISyncProgress | null
    syncStartedAt: number | null
    languageOverview: LanguageStat[]
    isSignedIn: boolean
    currentInput: string
    syncRepository(mode: 'import' | 'pull', options?: { automatic?: boolean }): Promise<void>
    loadGitStatus(repositoryId?: string): Promise<void>
    pullGitWorkspace(): Promise<void>
    commitSelectedFiles(): Promise<void>
    pushGitWorkspace(): Promise<void>
    togglePath(path: string): void
    stageAll(): void
}
