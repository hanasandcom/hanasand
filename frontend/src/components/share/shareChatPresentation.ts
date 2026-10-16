import type { BrowserEvidence, BrowserJourneyProof, PendingEdit, PendingShareChange, PlainProjectState, RunSummary } from './shareChatTypes'
import { normalizeSharePath } from './shareChatChanges'

export function extractVisibleCopy(content: string) {
    const htmlCopy = Array.from(content.matchAll(/>([^<>]+)</g))
        .map((match) => match[1]?.replace(/\s+/g, ' ').trim())
        .filter((copy): copy is string => Boolean(copy && copy.length > 2))
    const stringCopy = Array.from(content.matchAll(/['"`]([^'"`<>{}[\]=;]{12,160})['"`]/g))
        .map((match) => match[1]?.replace(/\s+/g, ' ').trim())
        .filter((copy): copy is string => Boolean(copy && /[a-zA-Z]/.test(copy)))
    return Array.from(new Set([...htmlCopy, ...stringCopy]))
}
export function getPlainProjectState({
    loading,
    elapsedSeconds,
    pendingStatus,
    lastRunStatus,
    activeProofs,
}: {
    loading: boolean
    elapsedSeconds: number
    pendingStatus?: PendingEdit['status']
    lastRunStatus?: RunSummary['status']
    activeProofs: number
}): PlainProjectState {
    if (loading) {
        if (elapsedSeconds < 4) {
            return { label: 'Planning', detail: 'Understanding the request and choosing the smallest useful change.', tone: 'working' }
        }
        return { label: 'Editing', detail: 'Preparing the project changes for your review.', tone: 'working' }
    }
    if (activeProofs || lastRunStatus === 'queued') {
        return { label: 'Verifying', detail: 'Opening the rendered page and checking whether the visible result still works.', tone: 'working' }
    }
    if (pendingStatus === 'pending') {
        return {
            label: 'Needs you',
            detail: 'Review the change, then apply or discard it.',
            tone: 'attention',
        }
    }
    if (pendingStatus === 'error' || lastRunStatus === 'error') {
        return { label: 'Failed with fix', detail: 'Something needs attention, but the next action explains how to continue.', tone: 'danger' }
    }
    if (pendingStatus === 'applied') {
        return { label: 'Ready to publish', detail: 'The latest approved changes are in the project.', tone: 'success' }
    }
    return { label: 'Ready', detail: 'Describe the result you want. No code or terminal knowledge needed.', tone: 'neutral' }
}

export function friendlyActivityMessage(content: string) {
    const safeContent = content.replace(new RegExp('pro' + 'of', 'gi'), 'check')
    const queuedPattern = new RegExp('Browser verification queued|Browser ' + 'pro' + 'of retry queued|Browser check queued|Browser check retry queued', 'i')
    const finishedPattern = new RegExp('Browser ' + 'pro' + 'of visible|Production ' + 'pro' + 'of visible|Browser check finished|Production check finished', 'i')
    if (queuedPattern.test(content)) {
        return { title: 'Browser check queued', detail: safeContent }
    }
    if (finishedPattern.test(content)) {
        return { title: 'Production check finished', detail: 'The result below shows what the browser checked and what remains unverified.' }
    }
    if (/Applied \d+ file change/i.test(content)) {
        return { title: 'Changes applied', detail: 'The approved updates are now part of the project.' }
    }
    if (/reconnecting|try .*again/i.test(content)) {
        return { title: 'Connection paused', detail: 'The service needs another try. Your project was not silently changed.' }
    }
    return null
}

export function plainChangeTitle(change: PendingShareChange, kind: string) {
    if (/readme|docs?\//i.test(change.path)) return 'Updated the project instructions'
    if (/docker|compose|env/i.test(change.path)) return 'Updated launch settings'
    if (/package\.json|tsconfig|next\.config/i.test(change.path)) return 'Updated app setup'
    if (/page|layout|component|src\/app/i.test(change.path)) return 'Updated the visible website'
    if (/test|spec|e2e|smoke/i.test(change.path)) return 'Updated checks'
    return change.created ? `Added ${kind.toLowerCase()}` : `Updated ${kind.toLowerCase()}`
}

export function plainPathLabel(path: string) {
    return `File: ${normalizeSharePath(path)}`
}

export function plainImpactForPath(path: string) {
    if (/docker|compose|env/i.test(path)) return 'Publishing'
    if (/page|layout|component|src\/app/i.test(path)) return 'Visitor view'
    if (/test|spec|e2e|smoke/i.test(path)) return 'Verification'
    if (/readme|docs?\//i.test(path)) return 'Docs'
    if (/package\.json|tsconfig|next\.config/i.test(path)) return 'App setup'
    return 'Project'
}

export function emptyBrowserStructure() {
    return {
        headings: [],
        links: [],
        buttons: [],
        inputs: [],
        forms: [],
        hasViewportMeta: false,
    }
}

export function summarizeBrowserEvidence(evidence: BrowserEvidence) {
    const structure = evidence.structure || emptyBrowserStructure()
    const issueCount = evidence.pageErrors?.filter(Boolean).length || 0
    const journey = evidence.journeyProof
    return [
        `Production check finished for ${evidence.url}.`,
        `Headings: ${structure.headings?.slice(0, 3).join(', ') || '<none>'}.`,
        `Links/buttons/forms: ${(structure.links?.length || 0)}/${(structure.buttons?.length || 0)}/${((structure.inputs?.length || 0) + (structure.forms?.length || 0))}.`,
        `Viewport: ${structure.hasViewportMeta ? 'present' : 'missing/unknown'}. Screenshot: ${evidence.screenshotPath ? 'available' : 'not available yet'}.`,
        journey ? `Journey dry run: ${journey.filledControls || 0} controls safely filled, mutation avoided: ${journey.readiness?.submitWithoutMutationAvoided ? 'yes' : 'unknown'}.` : 'Journey dry run: not available yet.',
        issueCount ? `Page issues: ${issueCount}.` : 'Page issues: none.',
    ].join('\n')
}

export function journeyTypeLabels(journey?: BrowserJourneyProof) {
    if (!journey?.journeyTypes) {
        return []
    }
    return [
        journey.journeyTypes.auth ? 'auth' : null,
        journey.journeyTypes.checkout ? 'checkout' : null,
        journey.journeyTypes.booking ? 'booking' : null,
        journey.journeyTypes.contact ? 'contact' : null,
        journey.journeyTypes.dashboardCrud ? 'dashboard' : null,
    ].filter(Boolean) as string[]
}
export function beginnerActionFailure(error?: string) {
    const value = error || ''
    if (/env|secret|token|credential|ssh key|private key/i.test(value)) {
        return 'This looks like a secret or private setting. Use a placeholder or connect it from the secure settings page.'
    }
    if (/production|database|backup|delete|destructive|wipe|drop|truncate/i.test(value)) {
        return 'This could affect real data. Try a preview, dry run, backup, or staging copy first.'
    }
    if (/domain|dns|ssl|certificate/i.test(value)) {
        return 'This looks like a domain or SSL setup problem. Check the domain records and certificate status before publishing.'
    }
    if (/build|deploy|runtime|log/i.test(value)) {
        return 'The app needs a build or deploy check before it can be published. Open the advanced logs for details.'
    }
    return 'Review the summary and try the smallest safer change.'
}
