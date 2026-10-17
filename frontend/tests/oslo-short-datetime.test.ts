// @ts-expect-error Bun provides this module when running focused tests.
import { expect, mock, test } from 'bun:test'
import { createElement, type ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { compactTime } from '../src/app/dashboard/management/audit/timelineRows'
import { shortTime } from '../src/app/dashboard/ti/dashboardPresentation'
import { shortDate } from '../src/app/dashboard/ti/runs/runPresentation'
import type { GetVulnerabilities, TrafficDomains, TrafficMetrics, TrafficRecords } from '../src/utils/monitoring/types'
import { formatOsloShortDateTime } from '../src/utils/date/formatOsloShortDateTime'

mock.module('next/navigation', () => ({ useRouter: () => ({ push: () => {} }) }))
const { default: TrafficOverviewClient } = await import('../src/components/monitoring/traffic/trafficOverview')
const { default: VulnerabilityHeader } = await import('../src/components/monitoring/vulnerabilities/header')

const previousFormat = new Intl.DateTimeFormat('en', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Oslo',
})

test('audit and TI views share the existing Oslo timestamp presentation', () => {
    for (const value of ['2026-01-15T12:34:00Z', '2026-07-15T12:34:00Z']) {
        const expected = previousFormat.format(new Date(value))
        expect(formatOsloShortDateTime(value)).toBe(expected)
        expect(compactTime(value)).toBe(expected)
        expect(shortDate(value)).toBe(expected)
        expect(shortTime(value)).toBe(expected)
    }
})

test('traffic and vulnerability views keep the same winter and summer date output', () => {
    for (const value of ['2026-01-15T12:34:00Z', '2026-07-15T12:34:00Z']) {
        const expected = previousFormat.format(new Date(value))
        const trafficHtml = renderTraffic(value)
        expect(trafficHtml).toContain('Traffic overview')
        expect(trafficHtml).toContain(expected)
        expect(renderVulnerabilityHeader(value)).toContain(expected)
    }
})

function renderTraffic(timestamp: string) {
    const domains: TrafficDomains = { domains: [] }
    const metrics: TrafficMetrics = {
        sampled_at: timestamp,
        total_requests: 1,
        avg_request_time: 0,
        error_rate: 0,
        top_methods: [],
        top_status_codes: [],
        top_domains: [],
        top_os: [],
        top_browsers: [],
        requests_over_time: [],
        top_error_paths: [],
        top_slow_paths: [],
        top_paths: [],
    }
    const records: TrafficRecords = {
        result: [{
            id: 1,
            user_agent: '',
            domain: 'example.test',
            path: '/',
            method: 'GET',
            referer: '',
            request_time: 0,
            status: 200,
            timestamp,
        }],
        total: 1,
    }
    return renderToStaticMarkup(createElement(TrafficOverviewClient, {
        domains,
        initialMetrics: metrics,
        initialRecords: records,
    }))
}

function renderVulnerabilityHeader(timestamp: string) {
    const scanStatus: GetVulnerabilities['scanStatus'] = {
        isRunning: false,
        startedAt: null,
        finishedAt: null,
        lastSuccessAt: null,
        lastError: null,
        totalImages: 0,
        completedImages: 0,
        currentImage: null,
        estimatedCompletionAt: null,
        enabled: true,
        paused: false,
        schedule: '',
        cadenceSeconds: 0,
        nextRunAt: timestamp,
        targetCount: 0,
        failureCount: 0,
        stale: false,
        staleReason: null,
        blocker: null,
        blockerAction: null,
        logs: [],
    }
    const props: ComponentProps<typeof VulnerabilityHeader> = {
        data: null,
        scanStatus,
        runScanAction: async () => 'unused in render test',
        isRefreshing: false,
        notice: {
            now: Date.now(),
            scanNotice: null,
            setScanNotice: () => {},
            dismissSeconds: null,
            dismissProgress: 0,
        },
        refresh: async () => {},
        setPageState: () => {},
        sorting: { images: [], sortMode: 'impact', setSortMode: () => {} },
        expansion: {
            expandedImages: [],
            areAllExpanded: false,
            toggleImage: () => {},
            toggleExpandAll: () => {},
        },
    }
    return renderToStaticMarkup(createElement(VulnerabilityHeader, props))
}
