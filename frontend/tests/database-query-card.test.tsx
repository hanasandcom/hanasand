// @ts-expect-error Bun provides this module when running focused tests.
import { expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { DatabaseQueryActivity } from '@/utils/db/internal'

const { default: QueryCard } = await import('../src/app/dashboard/db/queryCard')

const query: DatabaseQueryActivity = {
    database: 'appdb',
    user: 'service',
    state: 'active',
    durationSeconds: 61,
    waitEventType: null,
    waitEvent: null,
    query: 'select  id from users',
    isLongRunning: true,
}

function render(codeMode: 'raw' | 'highlighted') {
    return renderToStaticMarkup(createElement(QueryCard, {
        query,
        duration: '1m',
        collapsible: true,
        codeMode,
    }))
}

test('database query cards preserve raw SQL in disclosure mode', () => {
    const html = render('raw')

    expect(html).toContain('aria-label="SQL query" class="max-h-[32rem] overflow-auto rounded-md border border-ui-border bg-ui-canvas p-4 text-sm leading-6 text-ui-text">select  id from users</pre>')
    expect(html).toContain('aria-label="SQL query"')
    expect(html).toContain('<summary class="cursor-pointer list-none rounded focus-visible:outline-ui-primary hover:bg-ui-primary/5 [&amp;::-webkit-details-marker]:hidden"><span class="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ui-muted">')
    expect(html).toContain('1m · Long-running')
    expect(html).toContain('<dt class="text-xs text-ui-muted">Wait</dt><dd class="mt-1 wrap-break-word text-ui-text">None</dd>')
    expect(html).toContain('data-query-card')
})

test('database query cards retain formatted and highlighted SQL mode', () => {
    const html = render('highlighted')

    expect(html).toContain('<code>')
    expect(html).toContain('<span class="hljs-keyword">select</span>')
    expect(html).not.toContain('>select  id from users</pre>')
})
