type SavedFinding = { id: string; target: string }

export async function shareSavedFinding(run: SavedFinding): Promise<string> {
    const reportUrl = new URL('/sandbox/report', window.location.origin)
    reportUrl.searchParams.set('run', run.id)
    const url = reportUrl.toString()
    if (typeof navigator.share === 'function') {
        await navigator.share({ title: `Sandbox finding: ${run.target}`, url })
        return 'Finding shared.'
    }
    if (navigator.clipboard) {
        await navigator.clipboard.writeText(url)
        return 'Share link copied.'
    }
    window.prompt('Copy this finding link', url)
    return 'Share link ready.'
}
