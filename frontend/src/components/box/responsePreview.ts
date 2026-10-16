import type { ToolResponse } from './types'

export function getImagePreviewUrl(response: ToolResponse | null, requestUrl: string) {
    const contentType = Object.entries(response?.headers || {})
        .find(([key]) => key.toLowerCase() === 'content-type')?.[1] || ''

    if (contentType.toLowerCase().startsWith('image/')) {
        return requestUrl
    }

    if (isImageUrl(requestUrl)) {
        return requestUrl
    }

    const body = response?.body?.trim()
    if (body && isImageUrl(body)) {
        return body
    }

    return null
}

export function isImageUrl(value: string) {
    try {
        const url = new URL(value)
        return /\.(apng|avif|gif|jpe?g|png|svg|webp)(?:$|\?)/i.test(url.pathname + url.search)
    } catch {
        return false
    }
}
