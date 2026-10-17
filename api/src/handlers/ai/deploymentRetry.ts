import { createDeploymentEvent } from '#utils/ai/deploy.ts'

const DEPLOY_RETRY_ATTEMPTS = 3
const DEPLOY_RETRY_BASE_DELAY_MS = 500

export async function fetchWithDeployRetry<T>(
    url: string,
    init: RequestInit,
    events: AIDeploymentEvent[],
    label: string,
    stage: AIDeploymentEvent['stage'],
    readResponse: (response: Response) => Promise<T>,
) {
    let lastError: unknown = null

    for (let attempt = 1; attempt <= DEPLOY_RETRY_ATTEMPTS; attempt++) {
        try {
            const response = await fetch(url, init)
            const body = await readResponse(response)
            if (!shouldRetryResponse(response, attempt)) {
                return { response, body }
            }

            events.push(createDeploymentEvent(stage, retryMessage(label, `HTTP ${response.status}`, attempt), new Date().toISOString()))
        } catch (error) {
            lastError = error
            if (attempt >= DEPLOY_RETRY_ATTEMPTS) {
                throw error
            }

            events.push(createDeploymentEvent(stage, retryMessage(label, error instanceof Error ? error.message : 'request failed', attempt), new Date().toISOString()))
        }

        await delayDeployRetry(attempt)
    }

    throw lastError instanceof Error ? lastError : new Error(`Unable to reach ${label}.`)
}

function shouldRetryResponse(response: Response, attempt: number) {
    return attempt < DEPLOY_RETRY_ATTEMPTS && (response.status === 408 || response.status === 409 || response.status === 425 || response.status === 429 || response.status >= 500)
}

function retryMessage(label: string, reason: string, attempt: number) {
    return `Retrying ${label} after ${reason} (attempt ${attempt + 1}/${DEPLOY_RETRY_ATTEMPTS}).`
}

async function delayDeployRetry(attempt: number) {
    await new Promise((resolve) => setTimeout(resolve, DEPLOY_RETRY_BASE_DELAY_MS * attempt))
}
