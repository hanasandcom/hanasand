import { useEffect, useMemo, useRef, useState } from 'react'
import { getCookie } from '@/utils/cookies/cookies'
import { autoPullOptions, readAutoPullMinutes, readStoredGitWorkspace, rememberAutoPullMinutes, rememberGitWorkspace } from './storage'
import { createRepositorySync } from './syncRepository'
import { createWorkspaceOperations } from './workspaceOperations'
import type { GitOperationContext } from './operationContext'
import type { GitPluginProps, GitPluginState, LanguageStat, PendingGitAction, StoredGitWorkspace } from './types'

export function useGitPluginController({ shareRouteId, share }: GitPluginProps): GitPluginState {
    const [input, setInput] = useState('')
    const [githubToken, setGitHubToken] = useState('')
    const [status, setStatus] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [pending, setPending] = useState<PendingGitAction>(null)
    const [stored, setStored] = useState<StoredGitWorkspace | null>(null)
    const [gitStatus, setGitStatus] = useState<AIGitStatus | null>(null)
    const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set())
    const [commitMessage, setCommitMessage] = useState('')
    const [autoPullMinutes, setAutoPullMinutes] = useState(0)
    const [syncProgress, setSyncProgress] = useState<AISyncProgress | null>(null)
    const [syncStartedAt, setSyncStartedAt] = useState<number | null>(null)
    const [languageOverview, setLanguageOverview] = useState<LanguageStat[]>([])
    const userId = typeof document !== 'undefined' ? getCookie('id') || null : null
    const accessToken = typeof document !== 'undefined' ? getCookie('access_token') || null : null
    const isSignedIn = Boolean(userId && accessToken)
    const currentInput = useMemo(() => {
        if (input.trim()) return input.trim()
        if (stored?.input) return stored.input
        if (share?.git) return share.git
        return ''
    }, [input, share?.git, stored])

    useEffect(() => {
        const storedWorkspace = readStoredGitWorkspace(shareRouteId)
        setStored(storedWorkspace)
        if (storedWorkspace?.autoPullMinutes !== undefined) setAutoPullMinutes(storedWorkspace.autoPullMinutes)
        if (storedWorkspace?.input) setInput(storedWorkspace.input)
        else if (share?.git) setInput(share.git)
    }, [share?.git, shareRouteId])

    useEffect(() => {
        setAutoPullMinutes(readAutoPullMinutes(shareRouteId))
    }, [shareRouteId])

    const operationContext: GitOperationContext = {
        shareRouteId, share, userId, accessToken, isSignedIn, currentInput, githubToken,
        autoPullMinutes, commitMessage, selectedPaths, stored, gitStatus,
        setStatus, setError, setPending, setStored, setGitStatus, setSelectedPaths,
        setCommitMessage, setGitHubToken, setSyncProgress, setSyncStartedAt, setLanguageOverview,
    }
    const workspaceOperations = createWorkspaceOperations(operationContext)
    const syncRepository = createRepositorySync(operationContext, workspaceOperations.loadGitStatus)
    const syncRepositoryRef = useRef(syncRepository)
    syncRepositoryRef.current = syncRepository

    useEffect(() => {
        rememberAutoPullMinutes(shareRouteId, autoPullMinutes)
        if (stored) {
            rememberGitWorkspace(shareRouteId, { ...stored, autoPullMinutes })
            setStored(previous => previous ? { ...previous, autoPullMinutes } : previous)
        }
        if (!autoPullMinutes || !isSignedIn || !currentInput) return

        const timer = window.setInterval(() => {
            if (!pending) void syncRepositoryRef.current('pull', { automatic: true })
        }, autoPullMinutes * 60 * 1000)
        return () => window.clearInterval(timer)
    }, [autoPullMinutes, currentInput, isSignedIn, pending, shareRouteId])

    return {
        input, setInput, githubToken, setGitHubToken, status, error, pending, stored,
        gitStatus, selectedPaths, commitMessage, setCommitMessage, autoPullMinutes,
        setAutoPullMinutes: value => setAutoPullMinutes(autoPullOptions.some(option => option.value === value) ? value : 0),
        syncProgress, syncStartedAt, languageOverview, isSignedIn, currentInput,
        syncRepository, ...workspaceOperations,
    }
}
