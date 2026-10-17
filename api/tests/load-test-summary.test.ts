import { afterAll, expect, test } from 'bun:test'
import { access, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import readK6Summary from '../src/handlers/test/readK6Summary.ts'

let directory = ''

async function summaryFile(payload: unknown) {
    directory ||= await mkdtemp(path.join(os.tmpdir(), 'k6-summary-'))
    const file = path.join(directory, `${crypto.randomUUID()}.json`)
    await writeFile(file, JSON.stringify(payload))
    return file
}

afterAll(async () => {
    if (directory) await rm(directory, { recursive: true, force: true })
})

test('maps k6 nested metric values and removes the consumed summary file', async () => {
    const file = await summaryFile({ metrics: {
        http_req_duration: { values: { avg: 12, med: 10, 'p(90)': 18, 'p(95)': 20, max: 30 } },
        http_req_failed: { values: { rate: 0.05 } },
        http_reqs: { values: { count: 20 } },
        checks: { values: { passes: 18, fails: 2 } },
    } })

    expect(await readK6Summary(file)).toEqual({
        requests: 20, checks: 18, failures: 2, failureRate: 0.05,
        duration: { avg: 12, med: 10, p90: 18, p95: 20, max: 30 },
    })
    await expect(access(file)).rejects.toThrow()
})

test('maps flat metrics and supplies zeros for missing fields', async () => {
    const flatFile = await summaryFile({ metrics: {
        http_req_duration: { avg: 7, med: 6, 'p(90)': 9, 'p(95)': 10, max: 15 },
        http_req_failed: { value: 0.1 },
        http_reqs: { count: 10 },
        checks: { passes: 9, fails: 1 },
    } })
    expect(await readK6Summary(flatFile)).toEqual({
        requests: 10, checks: 9, failures: 1, failureRate: 0.1,
        duration: { avg: 7, med: 6, p90: 9, p95: 10, max: 15 },
    })

    const missingMetricsFile = await summaryFile({})
    expect(await readK6Summary(missingMetricsFile)).toEqual({
        requests: 0, checks: 0, failures: 0, failureRate: 0,
        duration: { avg: 0, med: 0, p90: 0, p95: 0, max: 0 },
    })
})

test('returns an empty summary for malformed or missing files', async () => {
    directory ||= await mkdtemp(path.join(os.tmpdir(), 'k6-summary-'))
    const malformedFile = path.join(directory, 'malformed.json')
    await writeFile(malformedFile, '{invalid json')
    const missingFile = path.join(directory, 'missing.json')

    expect(await readK6Summary(malformedFile)).toEqual({})
    expect(await readK6Summary(missingFile)).toEqual({})
    await expect(access(malformedFile)).rejects.toThrow()
})
