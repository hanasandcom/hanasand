type WebhookErrorPayload = { error?: { message?: string } }

export async function postWebhookJson<T extends WebhookErrorPayload>(
    url: string,
    body: Record<string, unknown>,
    fetcher: typeof fetch = fetch,
): Promise<T> {
    const response = await fetcher(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
    })
    const payload = await response.json().catch(() => ({})) as T
    if (!response.ok) throw new Error(payload.error?.message || response.statusText)
    return payload
}
