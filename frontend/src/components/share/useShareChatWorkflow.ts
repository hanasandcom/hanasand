import { useEffect, useState, type RefObject, type SyntheticEvent } from 'react'
import { submitShareChatPrompt } from './shareChatSubmit'
import type { BrowserEvidence, BrowserProofJob, Message, PendingEdit, RunSummary, ShareChatWorkflow } from './shareChatTypes'
import type { ShareChatProps } from './shareChatTypes'

export function useShareChatWorkflow({ share, tree, editingContent, previewUrl, inputRef, treePaths, mode }: Pick<ShareChatProps, 'share' | 'tree' | 'editingContent' | 'previewUrl' | 'mode'> & { inputRef: RefObject<HTMLTextAreaElement | null>; treePaths: string[] }) {
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const [startedAt, setStartedAt] = useState<number | null>(null)
    const [elapsedSeconds, setElapsedSeconds] = useState(0)
    const [pendingEdit, setPendingEdit] = useState<PendingEdit | null>(null)
    const [browserTarget, setBrowserTarget] = useState<{ url: string; title: string } | null>(null)
    const [browserEvidence, setBrowserEvidence] = useState<BrowserEvidence[]>([])
    const [lastRun, setLastRun] = useState<RunSummary | null>(null)
    const [browserProofJobs, setBrowserProofJobs] = useState<BrowserProofJob[]>([])
    const [hydrated, setHydrated] = useState(false)
    const [builderWorkflowOpen, setBuilderWorkflowOpen] = useState(mode === 'workspace')

    useEffect(() => setHydrated(true), [])
    useEffect(() => {
        if (!startedAt) {
            setElapsedSeconds(0)
            return
        }
        const updateElapsed = () => setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)))
        updateElapsed()
        const interval = window.setInterval(updateElapsed, 1000)
        return () => window.clearInterval(interval)
    }, [startedAt])

    function readSubmittedPrompt(form?: HTMLFormElement) {
        if (!form) return inputRef.current?.value || input
        const formData = new FormData(form)
        const submittedInput = formData.get('shareChatPrompt')
        const submittedFallback = formData.get('shareChatPromptFallback')
        return (typeof submittedInput === 'string' ? submittedInput : '')
            || (typeof submittedFallback === 'string' ? submittedFallback : '')
            || inputRef.current?.value
            || input
    }

    const workflow: ShareChatWorkflow = builderWorkflowOpen ? 'build' : 'ask'
    async function submitPrompt(rawPrompt: string) {
        await submitShareChatPrompt({ rawPrompt, share, tree, editingContent, previewUrl, treePaths, workflow, messages, loading, inputRef,
            setMessages, setInput, setLoading, setStartedAt, setPendingEdit, setBrowserTarget, setBrowserProofJobs, setBrowserEvidence, setLastRun })
    }

    async function submit(event?: SyntheticEvent<HTMLFormElement>) {
        event?.preventDefault()
        await submitPrompt(readSubmittedPrompt(event?.currentTarget))
    }

    return { messages, setMessages, input, setInput, loading, elapsedSeconds, pendingEdit, setPendingEdit, browserTarget, browserEvidence, setBrowserEvidence, lastRun, browserProofJobs, hydrated, builderWorkflowOpen, setBuilderWorkflowOpen, workflow, submitPrompt, submit, readSubmittedPrompt }
}
