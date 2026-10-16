// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { RecentTrafficTable } from '../src/components/monitoring/traffic/traffic'

const render = (overrides: Partial<Parameters<typeof RecentTrafficTable>[0]> = {}) => renderToStaticMarkup(createElement(RecentTrafficTable, {
    records: [],
    scrollContainerRef: { current: null },
    hasMore: false,
    loadingMore: false,
    loadError: null,
    onLoadMore: () => {},
    onScroll: () => {},
    ...overrides,
}))

test('recent traffic rows retain the accessible table and load states', () => {
    const html = render({
        records: [{ id: 7, user_agent: 'browser', domain: 'example.test', path: '/health', method: 'GET', referer: '', request_time: 12, status: 200, timestamp: '2026-10-15T12:00:00Z' }],
        hasMore: true,
        loadingMore: true,
        loadError: 'Connection lost',
    })

    expect(html).toContain('aria-label="Recent traffic requests"')
    expect(html).toContain('<th class="px-4 py-3">Path</th>')
    expect(html).toContain('example.test')
    expect(html).toContain('/health')
    expect(html).toContain('12ms')
    expect(html).toContain('role="alert"')
    expect(html).toContain('role="status"')
    expect(html).toContain('Load 10 more requests')
})

test('recent traffic shows an empty state when there are no rows or more pages', () => {
    expect(render()).toContain('No recent traffic has been recorded yet.')
})
