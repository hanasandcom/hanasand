'use client'

import Link from 'next/link'
import { RotateCcw, SquareArrowOutUpRight, X } from 'lucide-react'
import { useEffect, useRef } from 'react'

type ResumeNotice = {
    message: string
    workspaceId: string | null
} | null

export function AIPageNotices({
    statusNotice,
    resumeNotice,
    runtimeState,
    onDismissResumeNotice,
}: {
    statusNotice: string | null
    resumeNotice: ResumeNotice
    runtimeState: AIRuntimeState
    onDismissResumeNotice: () => void
}) {
    const dismissResumeNoticeRef = useRef(onDismissResumeNotice)
    const hasRuntimeNotice = !statusNotice && (runtimeState.lastFailure || runtimeState.lastToolRun)

    useEffect(() => {
        dismissResumeNoticeRef.current = onDismissResumeNotice
    }, [onDismissResumeNotice])

    useEffect(() => {
        if (!resumeNotice) return

        const timeout = window.setTimeout(() => dismissResumeNoticeRef.current(), 3000)
        return () => window.clearTimeout(timeout)
    }, [resumeNotice])

    if (!statusNotice && !resumeNotice && !hasRuntimeNotice) return null

    return (
        <div className='pointer-events-none absolute right-4 top-20 z-20 grid w-[min(32rem,calc(100%-2rem))] gap-3'>
            {statusNotice ? (
                <div className='pointer-events-auto rounded-lg border border-ui-warning/30 bg-ui-panel/95 px-4 py-3 text-sm text-ui-warning shadow-md backdrop-blur-xl'>
                    {statusNotice}
                </div>
            ) : null}

            {resumeNotice ? (
                <div role='status' aria-live='polite' aria-atomic='true' className='pointer-events-auto flex items-start justify-between gap-3 rounded-lg border border-ui-success/30 bg-ui-panel/95 px-4 py-3 text-sm text-ui-text shadow-md backdrop-blur-xl'>
                    <div className='flex min-w-0 items-start gap-3'>
                        <RotateCcw className='mt-0.5 h-4 w-4 shrink-0 text-ui-success' />
                        <div className='min-w-0'>
                            <p>{resumeNotice.message}</p>
                            {resumeNotice.workspaceId ? (
                                <Link href={`/s/${resumeNotice.workspaceId}`} className='mt-2 inline-flex items-center gap-2 text-xs font-semibold text-ui-primary underline-offset-4 hover:underline'>
                                    Open recovered workspace
                                    <SquareArrowOutUpRight className='h-3.5 w-3.5' />
                                </Link>
                            ) : null}
                        </div>
                    </div>
                    <button
                        type='button'
                        onClick={onDismissResumeNotice}
                        className='grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ui-muted transition-colors hover:bg-ui-raised hover:text-ui-text'
                        aria-label='Dismiss resume notice'
                    >
                        <X className='h-4 w-4' />
                    </button>
                </div>
            ) : null}

            {hasRuntimeNotice ? (
                <div className={`pointer-events-auto rounded-lg border px-4 py-3 text-sm shadow-md backdrop-blur-xl ${runtimeState.lastFailure ? 'border-ui-danger/30 bg-ui-panel/95 text-ui-text' : 'border-ui-border bg-ui-panel/95 text-ui-muted'}`}>
                    {runtimeState.lastFailure?.message || runtimeState.lastToolRun?.detail || runtimeStateSummary(runtimeState)}
                </div>
            ) : null}
        </div>
    )
}

function runtimeStateSummary(runtimeState: AIRuntimeState) {
    if (runtimeState.connectedClientCount > 0) {
        return `${runtimeState.connectedClientCount} connection${runtimeState.connectedClientCount === 1 ? '' : 's'} online`
    }

    return 'Hanasand GPT is unavailable'
}
