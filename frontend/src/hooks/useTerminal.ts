import { useMemo } from 'react'
import useTerminalActions from './useTerminalActions'
import useTerminalConnection from './useTerminalConnection'
import type { TerminalLifecycle } from './terminalTypes'

export type { TerminalCredentials, TerminalLifecycle } from './terminalTypes'

type TerminalProps = {
    share: Share | null
    active: boolean
}

export default function useTerminal({ share, active }: TerminalProps) {
    const shareId = share && 'id' in share ? share.id : null
    const shareAlias = share?.alias || null
    const sessionKey = active && shareId && shareAlias ? `${shareId}:${shareAlias}` : null
    const connection = useTerminalConnection({ sessionKey, shareAlias })
    const actions = useTerminalActions(sessionKey, connection.transport, connection)
    const view = useMemo(() => ({
        isConnected: sessionKey ? connection.isConnected : false,
        participants: sessionKey ? connection.participants : 1,
        chunks: sessionKey ? connection.chunks : [],
        status: sessionKey ? connection.status : 'Terminal closed.',
        credentials: sessionKey ? connection.credentials : null,
        lifecycle: sessionKey ? connection.lifecycle : 'closed' as TerminalLifecycle,
    }), [connection.chunks, connection.credentials, connection.isConnected, connection.lifecycle, connection.participants, connection.status, sessionKey])
    return { ...view, ...actions }
}
