import type { Dispatch, SetStateAction } from 'react'

export type ShareChatProps = {
    share: Share | null
    setShare: Dispatch<SetStateAction<Share | null>>
    tree?: Tree | null
    editingContent: string
    setEditorPatch: Dispatch<SetStateAction<{ value: string; nonce: number } | null>>
    mode?: 'panel' | 'workspace'
    previewUrl?: string | null
}

export type Message = {
    id: string
    role: 'user' | 'assistant' | 'tool'
    content: string
    createdAt: string
}

export type PendingEdit = {
    id: string
    changes: PendingShareChange[]
    status: 'pending' | 'applying' | 'applied' | 'error'
    error?: string
}

export type PendingShareChange = {
    id: string
    action: 'update_share' | 'upsert_share'
    shareId?: string
    path: string
    beforeContent: string
    content: string
    created?: boolean
}

export type ToolCall = {
    action?: 'update_share' | 'upsert_share' | 'create_share' | 'browser_task'
    shareId?: string
    path?: string
    content?: string
    type?: 'file' | 'folder'
    url?: string
    captureScreenshot?: boolean
    timeoutMs?: number
    actions?: ToolCall[]
}

export type BrowserTarget = {
    url: string
    title: string
}

export type BrowserEvidence = {
    id: string
    url: string
    title?: string | null
    screenshotPath?: string | null
    textExcerpt?: string
    structure?: {
        headings?: string[]
        links?: { text?: string, href?: string }[]
        buttons?: string[]
        inputs?: string[]
        forms?: string[]
        hasViewportMeta?: boolean
    }
    consoleMessages?: string[]
    pageErrors?: string[]
    quality?: BrowserQuality
    journeyProof?: BrowserJourneyProof
    fetchedAt: string
}

export type BrowserJourneyProof = {
    mode?: string
    forms?: number
    controls?: number
    fillableControls?: number
    focusedControls?: number
    filledControls?: number
    submitControls?: number
    buttonLabels?: string[]
    blockedControls?: string[]
    journeyTypes?: {
        auth?: boolean
        checkout?: boolean
        booking?: boolean
        contact?: boolean
        dashboardCrud?: boolean
    }
    readiness?: {
        hasVisibleAction?: boolean
        formsCanBeDryFilled?: boolean
        detectedCriticalJourney?: boolean
        submitWithoutMutationAvoided?: boolean
    }
}

export type BrowserQuality = {
    accessibilityBasics?: {
        hasTitle?: boolean
        hasH1?: boolean
        hasViewportMeta?: boolean
        unlabeledControls?: string[]
        imagesWithoutAlt?: string[]
    }
    brokenLinkBasics?: {
        checked?: number
        issues?: string[]
    }
    criticalJourneySignals?: {
        forms?: number
        buttons?: number
        auth?: boolean
        checkout?: boolean
        booking?: boolean
        dashboardCrud?: boolean
        liveDataClaim?: boolean
        sampleDataClaim?: boolean
    }
    notVerified?: string[]
}

export type RunSummary = {
    durationMs: number
    pendingChanges: number
    browserProofs: number
    tokenCap: number
    status: 'completed' | 'error' | 'queued'
}

export type BrowserProofJob = {
    id: string
    url: string
    status: 'queued' | 'running' | 'completed' | 'error'
    error?: string
}

export type VerificationJobResponse = {
    job?: {
        id: string
        kind: 'browser'
        status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
        currentStep?: string
        queuePosition?: number
        targetUrl?: string | null
        artifacts?: {
            type?: string
            data?: Record<string, unknown>
        }[]
        error?: string | null
    } | null
}

export type PlainProjectState = {
    label: 'Ready' | 'Planning' | 'Editing' | 'Verifying' | 'Needs you' | 'Ready to publish' | 'Failed with fix'
    detail: string
    tone: 'neutral' | 'working' | 'attention' | 'success' | 'danger'
}

export type ShareChatWorkflow = 'ask' | 'build'
