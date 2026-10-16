import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import { mergePresence, normalizePresenceUser, normalizePresenceUsers, type ShareConflict, type SharePresenceUser } from './shareCodePresence'

export type ShareCodeMessageContext = {
    latestContentRef: MutableRefObject<string>
    saveStateRef: MutableRefObject<'saved' | 'saving' | 'queued'>
    presenceUsersRef: MutableRefObject<SharePresenceUser[]>
    setError: Dispatch<SetStateAction<string | boolean | null>>
    setParticipants: Dispatch<SetStateAction<number>>
    setShare: Dispatch<SetStateAction<Share | null>>
    setEditingContent: Dispatch<SetStateAction<string>>
    setPresenceUsers: Dispatch<SetStateAction<SharePresenceUser[]>>
    setRemoteNotice: Dispatch<SetStateAction<string | null>>
    setConflict: Dispatch<SetStateAction<ShareConflict | null>>
    onSaveStateChange?: (state: 'saved' | 'saving' | 'queued') => void
}

export function handleShareCodeMessage(data: string, context: ShareCodeMessageContext) {
    const {
        latestContentRef,
        saveStateRef,
        presenceUsersRef,
        setError,
        setParticipants,
        setShare,
        setEditingContent,
        setPresenceUsers,
        setRemoteNotice,
        setConflict,
        onSaveStateChange,
    } = context

    try {
        const message = JSON.parse(data)
        if (message.type === 'update' && message.content !== latestContentRef.current) {
            setParticipants(message.participants)
            const author = presenceUsersRef.current.find(user => user.clientId === message.clientId) || null
            if (saveStateRef.current !== 'saved') {
                setConflict({
                    remoteContent: message.content,
                    localContent: latestContentRef.current,
                    author,
                    timestamp: message.timestamp || new Date().toISOString(),
                })
                setRemoteNotice(`${author?.displayName || 'Someone'} changed this file while your edit is unsaved.`)
                return
            }

            latestContentRef.current = message.content
            setEditingContent(message.content)
            setShare((prev) => prev ? { ...prev, timestamp: message.timestamp } : prev)
            setRemoteNotice(`${author?.displayName || 'Someone'} updated this file.`)
        }

        if (message.type === 'join') {
            setParticipants(message.participants)
            const users = normalizePresenceUsers(message.users)
            presenceUsersRef.current = users
            setPresenceUsers(users)
        }

        if (message.type === 'presence' && message.user) {
            setPresenceUsers(prev => {
                const users = mergePresence(prev, normalizePresenceUser(message.user))
                presenceUsersRef.current = users
                return users
            })
        }

        if (message.type === 'error') {
            onSaveStateChange?.('queued')
            setError(message.error || 'Unable to save your changes. Please retry.')
        }

        if (message.type === 'ack' && message.content === latestContentRef.current) {
            setError(null)
            onSaveStateChange?.('saved')
        }
    } catch (error) {
        console.error(`Invalid message from server: ${error}`)
    }
}
