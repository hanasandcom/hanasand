export async function fetchCaseSource(url: string, signal: AbortSignal) {
    for (let attempt = 0; attempt < 3; attempt++) {
        let response: Response
        try {
            response = await fetch(url, { cache: 'no-store', signal })
        } catch (error) {
            if (signal.aborted || attempt === 2) throw error
            await new Promise(resolve => setTimeout(resolve, 200 * (attempt + 1)))
            continue
        }
        if (response.status < 500 || attempt === 2) return response
        await response.body?.cancel().catch(() => {})
        await new Promise(resolve => setTimeout(resolve, 200 * (attempt + 1)))
    }
    throw new Error('Cases are unavailable.')
}
