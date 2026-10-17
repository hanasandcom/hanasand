'use client'

import { useMemo, useRef } from 'react'
import { listTreePaths } from './workspaceTree'
import type { ShareChatProps } from './shareChatTypes'
import { useShareChatWorkflow } from './useShareChatWorkflow'
import { useShareChatPendingEdit } from './useShareChatPendingEdit'
import { buildShareEvidenceUrl } from './shareChatPrompts'
import { getPlainProjectState } from './shareChatPresentation'
import { ShareChatHeader } from './ShareChatHeader'
import { ShareChatTranscript } from './ShareChatTranscript'
import { ShareChatPendingReview } from './ShareChatPendingReview'
import { ShareChatComposer } from './ShareChatComposer'

export default function ShareChat({ share, setShare, tree, editingContent, setEditorPatch, mode = 'panel', previewUrl }: ShareChatProps) {
    const inputRef = useRef<HTMLTextAreaElement | null>(null)
    const formRef = useRef<HTMLFormElement | null>(null)
    const treePaths = useMemo(() => listTreePaths(tree || null).slice(0, 80), [tree])
    const chat = useShareChatWorkflow({ share, tree, editingContent, previewUrl, inputRef, treePaths, mode })
    const { messages, setMessages, input, setInput, loading, elapsedSeconds, pendingEdit, setPendingEdit, browserTarget, browserEvidence, lastRun, browserProofJobs, hydrated, builderWorkflowOpen, setBuilderWorkflowOpen, workflow, submitPrompt, submit, readSubmittedPrompt } = chat
    const { applyPendingEdit, discardPendingEdit } = useShareChatPendingEdit({ share, tree, setShare, setEditorPatch, pendingEdit, setPendingEdit, setMessages })
    const pendingEditBlocksNewRun = pendingEdit?.status === 'pending' || pendingEdit?.status === 'applying'
    const canSend = hydrated && !loading && !pendingEditBlocksNewRun
    const showBuilderWorkflow = builderWorkflowOpen || Boolean(pendingEdit || browserProofJobs.length || browserEvidence.length || lastRun?.status === 'queued')
    const projectState = getPlainProjectState({ loading, elapsedSeconds, pendingStatus: pendingEdit?.status, lastRunStatus: lastRun?.status, activeProofs: browserProofJobs.filter(job => job.status === 'queued' || job.status === 'running').length })
    const shareTargetUrl = share ? buildShareEvidenceUrl(share) : null
    const checkTarget = previewUrl
        ? { label: 'Preview target', url: previewUrl }
        : shareTargetUrl ? { label: 'Current share target', url: shareTargetUrl } : null
    const primaryAction = pendingEdit?.status === 'pending'
        ? { label: 'Apply', detail: `${pendingEdit.changes.length} reviewed change${pendingEdit.changes.length === 1 ? '' : 's'} ready for you.`, disabled: false, onClick: applyPendingEdit }
        : pendingEdit?.status === 'error'
            ? { label: 'Review fix', detail: pendingEdit.error || 'A change needs attention before it can be applied.', disabled: false, onClick: () => inputRef.current?.focus() }
            : lastRun?.status === 'error'
                ? { label: 'Ask for a fix', detail: 'The last browser check found a problem. Describe what you want changed or retry verification.', disabled: false, onClick: () => inputRef.current?.focus() }
                : {
                    label: workflow === 'build' ? messages.length ? 'Ask for another change' : 'Describe request' : messages.length ? 'Ask another question' : 'Ask about this project',
                    detail: workflow === 'build' ? 'Tell Hanasand what you want in everyday language.' : 'Ask mode answers without changing files.',
                    disabled: loading, onClick: () => inputRef.current?.focus(),
                }

    return (
        <section className={`enterprise-console flex flex-col overflow-hidden rounded-lg border border-ui-border bg-ui-canvas/10 ${mode === 'workspace' ? 'h-full min-h-0 shadow-2xl shadow-ui-canvas/20' : 'h-[calc(100%-3.5rem)] min-h-[32rem]'}`}>
            <ShareChatHeader showBuilderWorkflow={showBuilderWorkflow} setBuilderWorkflowOpen={setBuilderWorkflowOpen} sharePath={share?.path || share?.alias || 'Workspace home'} projectState={projectState} loading={loading} elapsedSeconds={elapsedSeconds} primaryAction={primaryAction} pendingEdit={pendingEdit} treePaths={treePaths} browserProofJobs={browserProofJobs} browserEvidence={browserEvidence} checkTarget={checkTarget} />
            <ShareChatTranscript messages={messages} showBuilderWorkflow={showBuilderWorkflow} loading={loading} projectState={projectState} browserTarget={browserTarget} browserEvidence={browserEvidence} workspaceMode={mode === 'workspace'} />
            <ShareChatPendingReview pendingEdit={pendingEdit} pendingEditBlocksNewRun={Boolean(pendingEditBlocksNewRun)} browserEvidence={browserEvidence} lastRun={lastRun} discardPendingEdit={discardPendingEdit} applyPendingEdit={applyPendingEdit} />
            <ShareChatComposer formRef={formRef} inputRef={inputRef} submit={submit} input={input} setInput={setInput} showBuilderWorkflow={showBuilderWorkflow} canSend={canSend} submitPrompt={submitPrompt} readSubmittedPrompt={readSubmittedPrompt} pendingEditBlocksNewRun={Boolean(pendingEditBlocksNewRun)} />
        </section>
    )
}
