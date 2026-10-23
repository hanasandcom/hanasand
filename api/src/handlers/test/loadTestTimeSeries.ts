type MetricBucket = {
    requests: number
    failures: number
    latencies: number[]
    seenLatencies: number
}

type K6Point = { type?: string, metric?: string, data?: { time?: string, value?: number, tags?: Record<string, string> } }
const bucketSeconds = 5
const maxLatencySamplesPerBucket = 500

export class LoadTestTimeSeriesCollector {
    private buffer = ''
    private readonly buckets = new Map<number, MetricBucket>()

    constructor(private readonly startedAt: number, private readonly maxDurationSeconds = 600) {}

    push(chunk: string) {
        this.buffer += chunk
        const lines = this.buffer.split(/\r?\n/)
        this.buffer = lines.pop() ?? ''
        return lines.filter(line => !this.consumeLine(line)).join('\n')
    }

    finish() {
        const trailingText = this.consumeLine(this.buffer) ? '' : this.buffer
        this.buffer = ''
        const rps: Array<{ time: string, value: number }> = []
        const latency: Array<{ time: string, p50: number, p95: number }> = []
        const errors: Array<{ time: string, count: number }> = []

        for (const [index, bucket] of [...this.buckets.entries()].sort(([a], [b]) => a - b)) {
            const time = `${index * bucketSeconds}s`
            if (bucket.requests) rps.push({ time, value: bucket.requests / bucketSeconds })
            if (bucket.latencies.length) {
                const samples = bucket.latencies.sort((a, b) => a - b)
                latency.push({ time, p50: percentile(samples, 0.5), p95: percentile(samples, 0.95) })
            }
            if (bucket.requests) errors.push({ time, count: bucket.failures })
        }

        return { trailingText, metrics: { rps, latency, errors } }
    }

    private consumeLine(line: string) {
        if (!line.trim()) return true
        let record: K6Point
        try {
            record = JSON.parse(line) as K6Point
        } catch {
            return false
        }
        if (record.type !== 'Point' || typeof record.metric !== 'string' || !record.data) return true
        const data = record.data
        const timestamp = Date.parse(data.time ?? '')
        const value = Number(data.value)
        if (!Number.isFinite(timestamp) || !Number.isFinite(value)) return true
        const elapsed = Math.max(0, (timestamp - this.startedAt) / 1_000)
        if (elapsed > this.maxDurationSeconds) return true
        const bucketIndex = Math.floor(elapsed / bucketSeconds)
        let bucket = this.buckets.get(bucketIndex)
        if (!bucket) {
            bucket = { requests: 0, failures: 0, latencies: [], seenLatencies: 0 }
            this.buckets.set(bucketIndex, bucket)
        }

        if (record.metric === 'http_reqs') bucket.requests += value
        if (record.metric === 'http_req_failed' && value >= 1) bucket.failures += 1
        if (record.metric === 'http_req_duration') {
            bucket.seenLatencies += 1
            if (bucket.latencies.length < maxLatencySamplesPerBucket) bucket.latencies.push(value)
            else {
                const slot = Math.floor(Math.random() * bucket.seenLatencies)
                if (slot < maxLatencySamplesPerBucket) bucket.latencies[slot] = value
            }
        }
        return true
    }
}

function percentile(sorted: number[], fraction: number) {
    return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)] ?? 0
}
