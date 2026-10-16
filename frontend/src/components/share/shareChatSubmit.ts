import randomId from '@/utils/random/randomId'
import { requestShareChat, friendlyChatError } from './shareChatApi'
import { processBrowserChecks } from './shareChatProofWorkflow'
import { buildPrompt, buildContext, createOptimisticChatShare, stripToolTags, buildVisibleBuildReply } from './shareChatPrompts'
import { buildPendingChanges, parseToolCalls } from './shareChatChanges'
import type { BrowserEvidence, BrowserProofJob, Message, PendingEdit, RunSummary, ShareChatWorkflow } from './shareChatTypes'
import type { Dispatch, RefObject, SetStateAction } from 'react'

type SubmitOptions = {
    rawPrompt: string
    share: Share | null
    tree: Tree | null | undefined
    editingContent: string
    previewUrl: string | null | undefined
    treePaths: string[]
    workflow: ShareChatWorkflow
    messages: Message[]
    loading: boolean
    inputRef: RefObject<HTMLTextAreaElement | null>
    setMessages: Dispatch<SetStateAction<Message[]>>
    setInput: Dispatch<SetStateAction<string>>
    setLoading: Dispatch<SetStateAction<boolean>>
    setStartedAt: Dispatch<SetStateAction<number | null>>
    setPendingEdit: Dispatch<SetStateAction<PendingEdit | null>>
    setBrowserTarget: Dispatch<SetStateAction<{ url: string; title: string } | null>>
    setBrowserProofJobs: Dispatch<SetStateAction<BrowserProofJob[]>>
    setBrowserEvidence: Dispatch<SetStateAction<BrowserEvidence[]>>
    setLastRun: Dispatch<SetStateAction<RunSummary | null>>
}

export async function submitShareChatPrompt(options: SubmitOptions) {
    const { rawPrompt, share, tree, editingContent, previewUrl, treePaths, workflow, messages, loading, inputRef,
        setMessages, setInput, setLoading, setStartedAt, setPendingEdit, setBrowserTarget, setBrowserProofJobs, setBrowserEvidence, setLastRun } = options
    const trimmed = rawPrompt.trim()
    if (!trimmed || loading) return
    const activeShare = share || createOptimisticChatShare(trimmed)
    setMessages(current => [...current, { id: randomId(), role: 'user', content: trimmed, createdAt: new Date().toISOString() }])
    setInput('')
    setLoading(true)
    setStartedAt(Date.now())
    setPendingEdit(null)
    setLastRun(null)
    setBrowserProofJobs([])
    const startedAt = Date.now()
    const tokenCap = 2200
    try {
        const response = await requestShareChat({
            method: 'POST',
            body: JSON.stringify({
                prompt: buildPrompt(trimmed, activeShare, editingContent, treePaths, previewUrl || null, workflow),
                context: buildContext(activeShare, editingContent, treePaths, messages, previewUrl || null, trimmed, workflow),
                maxTokens: tokenCap,
            }),
        })
        const data = await response.json().catch(() => ({}))
        const rawContent = response.ok ? data.message || data.suggestion || 'No response.' : friendlyChatError(response.status)
        if (response.ok && data.intent === 'open_browser' && data.target?.url) {
            setBrowserTarget({ url: data.target.url, title: data.target.title || data.target.url })
        }
        if (workflow === 'ask') {
            setMessages(current => [...current, { id: randomId(), role: response.ok ? 'assistant' : 'tool', content: stripToolTags(rawContent).trim() || rawContent, createdAt: new Date().toISOString() }])
            setLastRun({ durationMs: Date.now() - startedAt, pendingChanges: 0, browserProofs: 0, tokenCap, status: response.ok ? 'completed' : 'error' })
            return
        }
        const toolCalls = parseToolCalls(rawContent)
        const pendingChanges = buildPendingChanges(toolCalls, activeShare, tree || null, editingContent)
        const browserCalls = toolCalls.filter(call => call.action === 'browser_task' && call.url).slice(0, 3)
        const visibleContent = buildVisibleBuildReply(rawContent, pendingChanges, browserCalls.length, response.ok)
        setMessages(current => [...current, { id: randomId(), role: response.ok ? 'assistant' : 'tool', content: visibleContent, createdAt: new Date().toISOString() }])
        if (pendingChanges.length) setPendingEdit({ id: randomId(), changes: pendingChanges, status: 'pending' })
        if (browserCalls.length) {
            setBrowserProofJobs(browserCalls.map(call => ({ id: randomId(), url: call.url || 'about:blank', status: 'queued' as const })))
            setMessages(current => [...current, { id: randomId(), role: 'tool', content: `Browser check queued for ${browserCalls.length} target${browserCalls.length === 1 ? '' : 's'}. You can keep reviewing while it runs.`, createdAt: new Date().toISOString() }])
            setLastRun({ durationMs: Date.now() - startedAt, pendingChanges: pendingChanges.length, browserProofs: browserCalls.length, tokenCap, status: 'queued' })
            void processBrowserChecks({ calls: browserCalls, pendingChanges: pendingChanges.length, tokenCap, startedAt, setBrowserProofJobs, setBrowserEvidence, setMessages, setLastRun })
        } else {
            setLastRun({ durationMs: Date.now() - startedAt, pendingChanges: pendingChanges.length, browserProofs: 0, tokenCap, status: response.ok ? 'completed' : 'error' })
        }
    } catch {
        setMessages(current => [...current, { id: randomId(), role: 'tool', content: 'The workspace assistant is reconnecting. Try the same message again in a moment.', createdAt: new Date().toISOString() }])
        setLastRun({ durationMs: Date.now() - startedAt, pendingChanges: 0, browserProofs: 0, tokenCap, status: 'error' })
    } finally {
        setLoading(false)
        setStartedAt(null)
        window.setTimeout(() => inputRef.current?.focus(), 0)
    }
}
