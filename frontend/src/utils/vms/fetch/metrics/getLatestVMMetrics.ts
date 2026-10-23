export default async function getLatestVMMetrics(): Promise<VMMetrics[]> {
    const response = await fetch('/api/backend/vm/metrics', {
        credentials: 'same-origin',
        cache: 'no-store',
    })
    if (!response.ok) throw new Error(await response.text())
    const metrics = await response.json() as unknown
    if (!Array.isArray(metrics)) throw new Error('VM disk metrics response is invalid.')
    return metrics as VMMetrics[]
}
