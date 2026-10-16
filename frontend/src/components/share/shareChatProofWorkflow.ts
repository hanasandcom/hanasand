import randomId from '@/utils/random/randomId'
import { runBrowserEvidenceTool } from './shareChatBrowserEvidence'
import { summarizeBrowserEvidence } from './shareChatPresentation'
import type { BrowserEvidence, BrowserProofJob, Message, RunSummary, ToolCall } from './shareChatTypes'
import type { Dispatch, SetStateAction } from 'react'

type ProofWorkflowOptions = {
    calls: ToolCall[]
    pendingChanges: number
    tokenCap: number
    startedAt: number
    setBrowserProofJobs: Dispatch<SetStateAction<BrowserProofJob[]>>
    setBrowserEvidence: Dispatch<SetStateAction<BrowserEvidence[]>>
    setMessages: Dispatch<SetStateAction<Message[]>>
    setLastRun: Dispatch<SetStateAction<RunSummary | null>>
}

export async function processBrowserChecks({ calls, pendingChanges, tokenCap, startedAt, setBrowserProofJobs, setBrowserEvidence, setMessages, setLastRun }: ProofWorkflowOptions) {
    const results: BrowserEvidence[] = []
    let hadIssues = calls.length === 0
    for (const call of calls) {
        const url = call.url || 'about:blank'
        setBrowserProofJobs(current => current.map(job => job.url === url ? { ...job, status: 'running' } : job))
        const result = await runBrowserEvidenceTool(call)
        if (result) {
            results.push(result)
            const issue = result.pageErrors?.filter(Boolean)[0]
            hadIssues ||= Boolean(issue)
            setBrowserEvidence(current => [result, ...current].slice(0, 5))
            setMessages(current => [...current, { id: randomId(), role: 'tool', content: summarizeBrowserEvidence(result), createdAt: new Date().toISOString() }])
            setBrowserProofJobs(current => current.map(job => job.url === url ? { ...job, status: issue ? 'error' : 'completed', error: issue } : job))
        } else {
            hadIssues = true
            setBrowserProofJobs(current => current.map(job => job.url === url ? { ...job, status: 'error', error: 'Browser check did not return.' } : job))
        }
    }
    setLastRun({ durationMs: Date.now() - startedAt, pendingChanges, browserProofs: results.length, tokenCap, status: hadIssues || results.length !== calls.length ? 'error' : 'completed' })
}
