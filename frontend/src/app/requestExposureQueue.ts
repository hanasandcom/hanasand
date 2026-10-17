import { normalizeExposureQueue, type ExposureQueue } from './exposureQueue'

type QueueFetcher = typeof fetch

export async function requestExposureQueue(params: URLSearchParams, fetcher: QueueFetcher = fetch): Promise<ExposureQueue> {
    const response = await fetcher(`/api/public/exposure-queue?${params.toString()}`, { cache: 'default' })
    if (!response.ok && response.status !== 202) throw new Error(`activity-status:${response.status}`)
    return normalizeExposureQueue(await response.json())
}
