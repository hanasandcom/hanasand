import { useEffect, useMemo, useRef, useState } from 'react'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import type { TerminalCredentials } from '@/hooks/useTerminal'
import type { ShareConflict, SharePresenceUser } from '@/components/share/useShareCodeSocket'
import { getCookie } from 'hanasand/cookies'
import { findPath, isWorkspaceRootItem } from '@/components/share/workspaceTree'
import { getShareRuntimeCapability } from '@/utils/share/runtimeCapabilities'
import postShare from '@/utils/share/post'

export type ClientPageProps = {
    id: string
    share: Share | null
    openFolders: string[]
    tree: Tree | null
    sharePageWidth: number
    shareTerminalHeight: number
    serverOpenFiles: OpenFile[]
    autoCreate: boolean
    initialChatOpen: boolean
    replaceUrlOnCreate: boolean
}

export function useShareWorkspaceState({
    id,
    share: serverShare,
    tree,
    sharePageWidth,
    shareTerminalHeight,
    serverOpenFiles,
    autoCreate,
    initialChatOpen,
    replaceUrlOnCreate,
}: ClientPageProps) {
    const [showExplorer, setShowExplorer] = useState(true)
    const [showMetadata, setShowMetaData] = useState(false)
    const [participants, setParticipants] = useState(1)
    const [isConnected, setIsConnected] = useState(false)
    const [saveState, setSaveState] = useState<'saved' | 'saving' | 'queued'>('saved')
    const [presenceUsers, setPresenceUsers] = useState<SharePresenceUser[]>([])
    const [selfClientId, setSelfClientId] = useState<string | null>(null)
    const [remoteNotice, setRemoteNotice] = useState<string | null>(null)
    const [conflict, setConflict] = useState<ShareConflict | null>(null)
    const [clickedWord, setClickedWord] = useState<string | null>(null)
    const [editingContent, setEditingContent] = useState(serverShare?.content || '')
    const [displayLineNumbers, setDisplayLineNumbers] = useState(true)
    const [syntaxHighlighting, setSyntaxHighlighting] = useState(true)
    const [box, setBox] = useState(false)
    const [share, setShare] = useState<Share | null>(serverShare)
    const [terminalOpen, setTerminalOpen] = useState(shareTerminalHeight > 0)
    const [terminalStatus, setTerminalStatus] = useState('Terminal closed.')
    const [terminalCredentials, setTerminalCredentials] = useState<TerminalCredentials | null>(null)
    const [workspaceTree, setWorkspaceTree] = useState<Tree | null>(tree)
    const [renderSite, setRenderSite] = useState(sharePageWidth > 0)
    const [triggerSiteChange, setTriggerSiteChange] = useState<boolean | 'close'>(false)
    const [triggerTerminalChange, setTriggerTerminalChange] = useState<boolean | 'close'>(false)
    const [openFiles, setOpenFiles] = useState(serverOpenFiles)
    const [workspaceCreated, setWorkspaceCreated] = useState(!autoCreate)
    const [editorPatch, setEditorPatch] = useState<{ value: string; nonce: number } | null>(null)
    const [chatOpen, setChatOpen] = useState(initialChatOpen)
    const [hydrated, setHydrated] = useState(false)
    const [explorerPanelRequest, setExplorerPanelRequest] = useState<{ panel: 'files' | 'search'; nonce: number } | null>(null)
    const hasCreatedWorkspace = useRef(false)
    const [createAttempt, setCreateAttempt] = useState(0)
    const { condition: error, setCondition: setError } = useClearStateAfter()
    const runtimeCapability = useMemo(() => getShareRuntimeCapability({
        share,
        tree: workspaceTree,
        activeContent: editingContent,
    }), [editingContent, share, workspaceTree])
    const activePath = useMemo(() => findPath(workspaceTree, share?.id || id), [id, share?.id, workspaceTree])
    const activeIsRoot = isWorkspaceRootItem(workspaceTree, share, share?.id || id)
    const activeLabel = activeIsRoot ? 'Workspace home' : activePath || share?.alias || 'Loading file'
    const previewEvidenceUrl = share?.alias && runtimeCapability.canPreview ? `https://${share.alias}.hanasand.com/` : null
    const otherUsers = presenceUsers.filter(user => user.clientId !== selfClientId)
    const remoteEditors = otherUsers.filter(user => user.editing)

    useEffect(() => setHydrated(true), [])

    useEffect(() => {
        if (!runtimeCapability.hasHttpSurface && renderSite) setRenderSite(false)
    }, [renderSite, runtimeCapability.hasHttpSurface])

    useEffect(() => {
        function handleShortcut(event: KeyboardEvent) {
            const key = event.key.toLowerCase()
            if (!(event.metaKey || event.ctrlKey)) return
            if (key === 's') {
                event.preventDefault()
                setSaveState('saving')
                setEditorPatch({ value: editingContent, nonce: Date.now() })
                setRemoteNotice('Save requested.')
            } else if (key === '`') {
                event.preventDefault()
                setTerminalOpen(true)
            } else if (key === 'f') {
                event.preventDefault()
                setShowExplorer(true)
                setExplorerPanelRequest({ panel: 'search', nonce: Date.now() })
            }
        }
        window.addEventListener('keydown', handleShortcut)
        return () => window.removeEventListener('keydown', handleShortcut)
    }, [editingContent])

    useEffect(() => {
        if (!autoCreate || hasCreatedWorkspace.current) return
        hasCreatedWorkspace.current = true
        setWorkspaceCreated(false)
        setSaveState('saving')

        async function createWorkspace() {
            const token = getCookie('access_token')
            const userId = getCookie('id')
            const createdShare = await postShare({
                includeTree: true,
                id,
                content: editingContent,
                name: id,
                path: id,
                type: 'folder',
                token,
                userId,
            })
            if (!createdShare) {
                hasCreatedWorkspace.current = false
                setWorkspaceCreated(false)
                setSaveState('queued')
                setError('Unable to save this workspace yet. Your editor stays open so you can retry.')
                return
            }

            setShare(createdShare)
            if ('tree' in createdShare && Array.isArray(createdShare.tree)) setWorkspaceTree(createdShare.tree)
            setWorkspaceCreated(true)
            setSaveState('saved')
            if (replaceUrlOnCreate) {
                window.history.replaceState(window.history.state, '', `/s/${id}${chatOpen ? '?chat=1' : ''}`)
            }
        }
        void createWorkspace()
    }, [autoCreate, createAttempt, id, replaceUrlOnCreate, setError])

    function retry() {
        if (!workspaceCreated) {
            hasCreatedWorkspace.current = false
            setError(null)
            setCreateAttempt(attempt => attempt + 1)
        } else {
            setEditorPatch({ value: editingContent, nonce: Date.now() })
        }
    }

    return {
        showExplorer, setShowExplorer, showMetadata, setShowMetaData, participants, setParticipants,
        isConnected, setIsConnected, saveState, setSaveState, presenceUsers, setPresenceUsers,
        selfClientId, setSelfClientId, remoteNotice, setRemoteNotice, conflict, setConflict,
        clickedWord, setClickedWord, editingContent, setEditingContent, displayLineNumbers,
        setDisplayLineNumbers, syntaxHighlighting, setSyntaxHighlighting, box, setBox, share,
        setShare, terminalOpen, setTerminalOpen, terminalStatus, setTerminalStatus,
        terminalCredentials, setTerminalCredentials, workspaceTree, setWorkspaceTree, renderSite,
        setRenderSite, triggerSiteChange, setTriggerSiteChange, triggerTerminalChange,
        setTriggerTerminalChange, openFiles, setOpenFiles, workspaceCreated, editorPatch,
        setEditorPatch, chatOpen, setChatOpen, hydrated, explorerPanelRequest, error, setError,
        runtimeCapability, activeLabel, previewEvidenceUrl, otherUsers, remoteEditors, retry,
    }
}
