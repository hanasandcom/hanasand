import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { BrowserControlSocket } from '../controlSocket'
import type {
    BrowserNetwork,
    BrowserQuota,
    BrowserRunHistory,
    Capture,
    RunTiming,
    SandboxCapacity,
    SessionState,
    SocketState,
    StreamStats,
} from '../types'
import type { BrowserRunOverride } from './BrowserWorkspaceTypes'

export type BrowserSocketMessageContext = {
    payload: Record<string, unknown>
    socket: BrowserControlSocket
    runState: { receivedEnd: boolean; lastPageUrl: string; replacing: boolean; navigationFailed: boolean; receivedPageFrame: boolean }
    override?: BrowserRunOverride
    id: string
    url: string
    runNetwork: BrowserNetwork
    socketRef: MutableRefObject<BrowserControlSocket | null>
    stoppedRunRef: MutableRefObject<boolean>
    receivedEvidenceRef: MutableRefObject<boolean>
    recoveryDeadlineRef: MutableRefObject<number>
    replaceSandbox: () => void
    refreshRunStats: () => Promise<void>
    pushEvent: (event: string) => void
    pushConsoleEvent: (event: string, provider?: boolean) => void
    setSocketState: Dispatch<SetStateAction<SocketState>>
    setStreamUrl: Dispatch<SetStateAction<string>>
    setCaptures: Dispatch<SetStateAction<Capture[]>>
    setStreamStats: Dispatch<SetStateAction<StreamStats>>
    setRunTiming: Dispatch<SetStateAction<RunTiming | null>>
    setClockNow: Dispatch<SetStateAction<number>>
    setCapacity: Dispatch<SetStateAction<SandboxCapacity | null>>
    setHistory: Dispatch<SetStateAction<BrowserRunHistory[]>>
    setQuota: Dispatch<SetStateAction<BrowserQuota | null>>
    setSessionState: Dispatch<SetStateAction<SessionState>>
    setRunBlocker: Dispatch<SetStateAction<string>>
    setActiveImage: Dispatch<SetStateAction<string | null>>
    setActiveUrl: Dispatch<SetStateAction<string>>
    setRemoteTabUrls: Dispatch<SetStateAction<Record<string, string>>>
    setActiveFrame: Dispatch<SetStateAction<{ width: number; height: number }>>
    setStartupStage: Dispatch<SetStateAction<number>>
    setActiveSandboxTab: Dispatch<SetStateAction<string>>
}
