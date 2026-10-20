import { useRef, useState } from 'react'
import { getCookie } from '@/utils/cookies/cookies'
import { useShareWorkspaceState } from './useShareWorkspaceState'
import type { AiToolCall } from './aiToolTypes'
import type { AIWorkbenchInitialData } from './initialData'

export function useWorkbenchState({
    initialConversations,
    initialRepositories,
    initialDeployments,
    initialReleases,
    initialDeployQuota,
    initialOwnershipSummary,
    initialShares,
    initialRuntimeState,
    initialWorkspaceUnavailable = false,
    isAuthenticated,
    initialConversationId = null,
}: AIWorkbenchInitialData) {
    const socketRef = useRef<WebSocket | null>(null)
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const shouldReconnectRef = useRef(true)
    const bootstrappedRef = useRef(false)
    const conversationsRef = useRef<AIConversation[]>(initialConversations)
    const createNewConversationRef = useRef<() => Promise<void>>(async () => {})
    const hydrateShareRef = useRef<(shareId: string) => Promise<Share | null>>(async () => null)
    const hydrateShareFileRef = useRef<(rootId: string, filePath: string) => Promise<string | null>>(async () => null)
    const handleSocketMessageRef = useRef<(message: GptSocketMessage) => void>(() => {})
    const executeAssistantToolsRef = useRef<(conversation: AIConversation, message: AIConversationMessage) => Promise<void>>(async () => {})
    const runToolCallRef = useRef<(conversation: AIConversation, toolCall: AiToolCall) => Promise<{ ok: boolean, message: string, artifacts?: AIArtifact[] }>>(async () => ({ ok: false, message: 'Tool unavailable.' }))
    const refreshRuntimeRef = useRef<() => Promise<void>>(async () => {})
    const [clients, setClients] = useState<GPT_Client[]>([])
    const [participants, setParticipants] = useState(initialRuntimeState?.connectedClientCount || 0)
    const [isConnected, setIsConnected] = useState(Boolean(initialRuntimeState?.connectedClientCount))
    const [statusNotice, setStatusNotice] = useState<string | null>(initialWorkspaceUnavailable
        ? 'Couldn’t load your chats. Refresh to try again.'
        : initialRuntimeState?.lastFailure?.message || null)
    const [runtimeSnapshot, setRuntimeSnapshot] = useState<AIRuntimeState | null>(initialRuntimeState)
    const [aiApiAvailable, setAiApiAvailable] = useState(isAuthenticated)
    const [conversations, setConversations] = useState<AIConversation[]>(initialConversations)
    const [activeConversationId, setActiveConversationId] = useState<string | null>(initialConversationId || initialConversations[0]?.id || null)
    const [composer, setComposer] = useState('')
    const [search, setSearch] = useState('')
    const [importInput, setImportInput] = useState('')
    const [githubToken, setGitHubToken] = useState('')
    const [importError, setImportError] = useState<string | null>(null)
    const [importPending, setImportPending] = useState(false)
    const [collaborationError, setCollaborationError] = useState<string | null>(null)
    const [collaboratorPending, setCollaboratorPending] = useState(false)
    const [syncingRepoId, setSyncingRepoId] = useState<string | null>(null)
    const [importedRepos, setImportedRepos] = useState<AIImportedRepo[]>(initialRepositories)
    const [deployments, setDeployments] = useState<AIDeployment[]>(initialDeployments)
    const [deployPending, setDeployPending] = useState(false)
    const [releases, setReleases] = useState<AIRelease[]>(initialReleases)
    const [deployQuota, setDeployQuota] = useState<AIDeployQuota | null>(initialDeployQuota)
    const [ownershipSummary] = useState<AIOwnershipSummary | null>(initialOwnershipSummary)
    const [rollbackPendingId, setRollbackPendingId] = useState<string | null>(null)
    const [availableVmTargets, setAvailableVmTargets] = useState<AgentVmTarget[]>([])
    const [resumeNotice, setResumeNotice] = useState<{
        message: string
        conversationId: string | null
        workspaceId: string | null
    } | null>(null)
    const currentUserId = typeof document !== 'undefined' ? getCookie('id') || null : null
    const shareState = useShareWorkspaceState({ initialShares })

    return {
        socketRef, reconnectTimerRef, shouldReconnectRef, bootstrappedRef, conversationsRef,
        createNewConversationRef, hydrateShareRef, hydrateShareFileRef, handleSocketMessageRef,
        executeAssistantToolsRef, runToolCallRef, refreshRuntimeRef, clients, setClients,
        participants, setParticipants, isConnected, setIsConnected, statusNotice, setStatusNotice,
        runtimeSnapshot, setRuntimeSnapshot, aiApiAvailable, setAiApiAvailable, conversations,
        setConversations, activeConversationId, setActiveConversationId, composer, setComposer,
        search, setSearch, importInput, setImportInput, githubToken, setGitHubToken, importError,
        setImportError, importPending, setImportPending, collaborationError, setCollaborationError,
        collaboratorPending, setCollaboratorPending, syncingRepoId, setSyncingRepoId, importedRepos,
        setImportedRepos, deployments, setDeployments, deployPending, setDeployPending, releases,
        setReleases, deployQuota, setDeployQuota, ownershipSummary, rollbackPendingId,
        setRollbackPendingId, availableVmTargets, setAvailableVmTargets, resumeNotice, setResumeNotice,
        currentUserId, isAuthenticated, initialRuntimeState, initialConversationId,
        initialWorkspaceUnavailable,
        ...shareState,
    }
}

export type WorkbenchState = ReturnType<typeof useWorkbenchState>
