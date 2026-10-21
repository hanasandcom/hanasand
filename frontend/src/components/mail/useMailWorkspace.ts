'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchMailOverview, messageAction, searchMail, sendMail, type DraftAttachment } from '@/utils/mail/client'
import type { MailMessage, MailMessageSummary, MailOverview } from '@/utils/mail/types'
import { needsSelectedMessageRequest, resolveMailboxPage } from './mailWorkspacePage'

export type ComposeDraft = { to: string, cc: string, bcc: string, subject: string, textBody: string, attachments: DraftAttachment[] }
type Location = { user: string, folder: string, message: string }

export function useMailWorkspace(initialMailboxUser?: string | null) {
    const [overview, setOverview] = useState<MailOverview | null>(null)
    const [mailboxUser, setMailboxUser] = useState(initialMailboxUser || '')
    const [mailboxId, setMailboxId] = useState('')
    const [selectedMessageId, setSelectedMessageId] = useState('')
    const [searchText, setSearchText] = useState('')
    const [searchResults, setSearchResults] = useState<MailMessageSummary[] | null>(null)
    const [loading, setLoading] = useState(true)
    const [messageLoading, setMessageLoading] = useState(false)
    const [working, setWorking] = useState(false)
    const [error, setError] = useState('')
    const [draft, setDraft] = useState<ComposeDraft | null>(null)
    const position = useRef<Location>({ user: initialMailboxUser || '', folder: '', message: '' })
    const version = useRef(0)
    const searchVersion = useRef(0)
    const hasLoaded = useRef(false)

    const load = useCallback(async (options: Partial<Location> & { background?: boolean } = {}) => {
        const currentVersion = ++version.current
        const user = options.user ?? position.current.user
        const folder = options.folder ?? position.current.folder
        const requestedMessage = options.message ?? position.current.message
        if (!options.background) setLoading(!hasLoaded.current)
        setError('')
        try {
            const first = await fetchMailOverview({ mailboxUser: user || undefined, mailboxId: folder || null })
            const { selectedFolder, useFirstPage } = resolveMailboxPage(first, folder)
            const page = useFirstPage ? first : await fetchMailOverview({ mailboxUser: user || first.mailboxUser, mailboxId: selectedFolder || null })
            if (currentVersion !== version.current) return
            const selected = requestedMessage || page.messages[0]?.id || ''
            const nextUser = user || first.mailboxUser
            position.current = { user: nextUser, folder: selectedFolder, message: selected }
            setMailboxUser(nextUser); setMailboxId(selectedFolder); setSelectedMessageId(selected)
            setOverview(current => ({
                ...page,
                selectedMailboxId: selectedFolder || null,
                selectedMessage: page.selectedMessage?.id === selected
                    ? page.selectedMessage
                    : options.background && current?.selectedMessage?.id === selected ? current.selectedMessage : null,
            }))
            hasLoaded.current = true
            if (needsSelectedMessageRequest(page, selected)) void fetchMailOverview({ mailboxUser: nextUser, mailboxId: selectedFolder, messageId: selected }).then(detail => {
                if (currentVersion === version.current) setOverview(value => value ? { ...value, selectedMessage: detail.selectedMessage } : value)
            }).catch(() => {})
        } catch (cause) {
            if (currentVersion === version.current) setError(cause instanceof Error ? cause.message : 'Unable to load mail.')
        } finally {
            if (currentVersion === version.current) setLoading(false)
        }
    }, [])

    useEffect(() => { void load({ user: initialMailboxUser || '', folder: '', message: '' }); return () => { version.current++ } }, [initialMailboxUser, load])
    useEffect(() => {
        const timer = window.setInterval(() => void load({ background: true }), 30_000)
        return () => window.clearInterval(timer)
    }, [load])
    useEffect(() => {
        const term = searchText.trim()
        const currentVersion = ++searchVersion.current
        if (term.length < 2 || !mailboxUser || !mailboxId) { setSearchResults(null); return }
        const timer = window.setTimeout(() => {
            void searchMail({ mailboxUser, mailboxId, query: term }).then(result => {
                if (currentVersion === searchVersion.current) setSearchResults(result.messages)
            }).catch(cause => {
                if (currentVersion === searchVersion.current) setError(cause instanceof Error ? cause.message : 'Search is unavailable.')
            })
        }, 250)
        return () => window.clearTimeout(timer)
    }, [searchText, mailboxUser, mailboxId])

    const messages = useMemo(() => searchResults ?? overview?.messages ?? [], [searchResults, overview?.messages])
    const selectedMessage = overview?.selectedMessage?.id === selectedMessageId ? overview.selectedMessage as MailMessage : null

    const switchAccount = useCallback((user: string) => {
        position.current = { user, folder: '', message: '' }
        hasLoaded.current = false
        setOverview(null); setSearchResults(null); setMailboxUser(user); setMailboxId(''); setSelectedMessageId('')
        void load({ user, folder: '', message: '' })
    }, [load])
    const selectFolder = useCallback((folder: string) => {
        position.current.folder = folder; position.current.message = ''
        hasLoaded.current = false
        setSearchResults(null); setMailboxId(folder); setSelectedMessageId('')
        void load({ folder, message: '' })
    }, [load])
    const selectMessage = useCallback(async (message: MailMessageSummary) => {
        position.current.message = message.id
        setSelectedMessageId(message.id)
        setMessageLoading(true)
        setOverview(value => value ? { ...value, selectedMessage: null } : value)
        try {
            const detail = await fetchMailOverview({ mailboxUser: position.current.user, mailboxId: position.current.folder, messageId: message.id })
            if (position.current.message === message.id) setOverview(value => value ? { ...value, selectedMessage: detail.selectedMessage } : value)
            if (!message.isRead) {
                await messageAction(message.id, { mailboxUser: position.current.user, action: 'read' })
                if (position.current.message === message.id) setOverview(value => value ? {
                    ...value,
                    selectedMessage: value.selectedMessage ? { ...value.selectedMessage, isRead: true } : value.selectedMessage,
                    messages: value.messages.map(item => item.id === message.id ? { ...item, isRead: true } : item),
                } : value)
            }
        } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not open this message.') }
        finally { if (position.current.message === message.id) setMessageLoading(false) }
    }, [])
    const act = useCallback(async (message: MailMessageSummary, action: 'archive' | 'trash' | 'read' | 'unread' | 'flag' | 'unflag') => {
        setWorking(true)
        try {
            await messageAction(message.id, { mailboxUser: position.current.user, action })
            if (action === 'archive' || action === 'trash') position.current.message = ''
            await load({ background: true, message: position.current.message })
        } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not update this message.') }
        finally { setWorking(false) }
    }, [load])
    const send = useCallback(async (value: ComposeDraft) => {
        if (!position.current.user || !value.to.trim()) return
        setWorking(true)
        try { await sendMail({ mailboxUser: position.current.user, ...value }); setDraft(null); await load({ background: true }) }
        catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not send this message.') }
        finally { setWorking(false) }
    }, [load])
    const reply = useCallback((message: MailMessage, all = false) => {
        const own = overview?.mailboxAddress.toLowerCase()
        const allRecipients = [...message.replyTo, ...message.from, ...message.to, ...message.cc]
        const recipients = all ? allRecipients : message.replyTo.length ? message.replyTo : message.from
        const to = [...new Set(recipients.map(item => item.email).filter(email => email.toLowerCase() !== own))].join(', ')
        setDraft({ to, cc: all ? message.cc.map(item => item.email).filter(email => email.toLowerCase() !== own).join(', ') : '', bcc: '', subject: /^re:/i.test(message.subject) ? message.subject : `Re: ${message.subject}`, textBody: `\n\n${message.textBody.split('\n').map(line => `> ${line}`).join('\n')}`, attachments: [] })
    }, [overview?.mailboxAddress])

    return { overview, mailboxUser, mailboxId, selectedMessageId, selectedMessage, messages, loading, messageLoading, working, error, setError, searchText, setSearchText, draft, setDraft, load, switchAccount, selectFolder, selectMessage, act, send, reply }
}
