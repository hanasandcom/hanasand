'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { PromptPortalItem, PromptPortalPublicState } from '@/utils/promptPortal/store'
import { comparePromptItems } from '@/utils/promptPortal/ordering'

const emptyState: PromptPortalPublicState = { items: [] }

export function usePromptPortal(enabled: boolean, conversation: AIConversation | null) {
    const [state, setState] = useState(emptyState)
    const [priority, setPriority] = useState<'now' | 'next'>('next')
    const [files, setFiles] = useState<FileList | null>(null)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const conversationId = conversation?.id || ''
    const pending = useMemo(() => state.items.filter(item => item.status === 'queued' || item.status === 'running').sort(comparePromptItems), [state.items])
    const queueOrder = useMemo(() => pending.filter(item => item.status === 'queued'), [pending])
    const chatGPTConversation = useMemo(() => conversation ? {
        ...conversation,
        id: 'hanasand-chatgpt',
        title: 'ChatGPT',
        activeModel: 'ChatGPT',
        preferredModel: 'ChatGPT',
        messages: state.items.slice().sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)).flatMap(portalMessages),
    } : null, [conversation, state.items])

    const refresh = useCallback(async () => {
        if (!enabled || !conversationId) return
        const response = await fetch(`/api/prompt?conversationId=${encodeURIComponent(conversationId)}`, { cache: 'no-store' }).catch(() => null)
        const payload = await response?.json().catch(() => null)
        if (!response?.ok) {
            setError(payload?.error?.message || 'Could not load ChatGPT activity.')
            return
        }
        if (payload?.items) { setState(payload); setError('') }
    }, [conversationId, enabled])

    useEffect(() => {
        if (!enabled || !conversationId) return
        void refresh()
        const interval = window.setInterval(() => void refresh(), 4000)
        return () => window.clearInterval(interval)
    }, [conversationId, enabled, refresh])

    useEffect(() => {
        setState(emptyState)
        setError('')
    }, [conversationId])

    const submit = useCallback(async (prompt: string) => {
        setBusy(true)
        setError('')
        const form = new FormData()
        form.set('prompt', prompt)
        form.set('conversationId', conversationId)
        form.set('priority', priority)
        Array.from(files || []).forEach(file => form.append('files', file))
        const response = await fetch('/api/prompt', { method: 'POST', body: form }).catch(() => null)
        const payload = await response?.json().catch(() => null)
        setBusy(false)
        if (!response?.ok) {
            setError(payload?.error?.message || payload?.error || 'Unable to send to ChatGPT.')
            return false
        }
        setFiles(null)
        setState(payload)
        return true
    }, [conversationId, files, priority])

    const mutate = useCallback(async (action: 'edit' | 'delete' | 'reorder', item: PromptPortalItem, extra: Record<string, unknown> = {}) => {
        setBusy(true)
        setError('')
        const response = await fetch('/api/prompt', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ action, id: item.id, conversationId, ...extra }),
        }).catch(() => null)
        const payload = await response?.json().catch(() => null)
        setBusy(false)
        if (!response?.ok) {
            setError(payload?.error?.message || payload?.error || 'Unable to update the request.')
            return
        }
        setState(payload)
    }, [conversationId])

    const edit = useCallback((item: PromptPortalItem) => {
        const prompt = window.prompt('Edit request', item.prompt)
        if (prompt !== null) void mutate('edit', item, { prompt })
    }, [mutate])

    return { chatGPTConversation, items: state.items, error, busy, priority, setPriority, files, setFiles, pending, queueOrder, refresh, submit, mutate, edit }
}

function portalMessages(item: PromptPortalItem): AIConversationMessage[] {
    const elapsed = Math.max(0, Math.floor((Date.parse(item.completedAt || new Date().toISOString()) - Date.parse(item.startedAt || item.createdAt)) / 1000))
    const duration = elapsed < 60 ? `${elapsed}s` : `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`
    const metadata = { promptPortalId: item.id, promptPortalStatus: item.status, priority: item.priority,
        statusText: item.status === 'running' ? `Working · ${duration}`
            : item.status === 'queued' ? item.priority === 'now' ? 'Up next' : 'In line'
                : item.status === 'done' ? `Finished · ${duration}` : `Could not complete · ${duration}` }
    const assistantContent = item.status === 'running' ? 'Working on it…'
        : item.status === 'queued' ? item.priority === 'now' ? 'Up next.' : 'In the queue.'
            : item.result || (item.status === 'error' ? 'The request could not be completed.' : '')
    return [
        { id: `${item.id}-request`, role: 'user', content: item.prompt, createdAt: item.createdAt, metadata: { ...metadata, files: item.files } },
        { id: `${item.id}-response`, role: 'assistant', content: assistantContent, createdAt: item.completedAt || item.startedAt || item.createdAt, modelName: 'ChatGPT', pending: item.status === 'running', error: item.status === 'error', metadata },
    ]
}
