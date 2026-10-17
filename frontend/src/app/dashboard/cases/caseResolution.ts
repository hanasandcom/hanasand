type ReviewableResolution = { type: string, confirmedAt?: string }

function isAutomatedResolution(resolution?: ReviewableResolution | null) {
    return Boolean(resolution && ['ai', 'automation'].includes(resolution.type))
}

export function requiresHumanReview(resolution?: ReviewableResolution | null) {
    return isAutomatedResolution(resolution) && !resolution?.confirmedAt
}

export function humanReviewLabel(resolution?: ReviewableResolution | null) {
    if (!isAutomatedResolution(resolution)) return undefined
    return requiresHumanReview(resolution) ? 'Needs human review' : 'Human confirmed'
}
