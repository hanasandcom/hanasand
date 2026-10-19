type CompletionMessage = { role: 'system' | 'user' | 'assistant', content: string }

export async function requestAiCompletion(messages: CompletionMessage[], timeoutMs = 15_000) {
    const base = (process.env.AI_API_BASE || 'http://ai:19182').replace(/\/+$/, '')
    const serviceKey = process.env.SUPPORT_SERVICE_KEY
    if (!serviceKey) throw new Error('AI service credentials are not configured.')
    const response = await fetch(`${base}/api/internal/model/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-support-service-key': serviceKey },
        body: JSON.stringify({ messages }),
        signal: AbortSignal.timeout(timeoutMs),
    })
    if (!response.ok) throw new Error(`AI completion failed (${response.status}).`)
    const body = await response.json() as { content?: unknown }
    if (typeof body.content !== 'string') throw new Error('AI service returned an invalid completion.')
    return body.content
}
