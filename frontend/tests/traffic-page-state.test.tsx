// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { TrafficPageState } from '../src/app/dashboard/traffic/TrafficPageState'

const renderState = (kind: 'loading' | 'unavailable', message: string, panelClassName?: string) =>
    renderToStaticMarkup(createElement(TrafficPageState, { kind, message, panelClassName }))

test('traffic overview loading and unavailable states preserve their rendered panel contract', () => {
    expect(renderState('loading', 'Loading traffic statistics…')).toBe(
        '<section class="rounded-lg border border-ui-border bg-ui-panel shadow-sm shadow-ui-canvas/10 dark:shadow-ui-canvas/20 p-4"><p role="status">Loading traffic statistics…</p></section>',
    )
    expect(renderState('unavailable', 'Traffic statistics are temporarily unavailable. Refresh to try again.')).toBe(
        '<section class="rounded-lg border border-ui-border bg-ui-panel shadow-sm shadow-ui-canvas/10 dark:shadow-ui-canvas/20 p-4"><p role="alert">Traffic statistics are temporarily unavailable. Refresh to try again.</p></section>',
    )
})

test('live map and recent traffic keep route-specific messages and layout classes', () => {
    expect(renderState('loading', 'Loading live traffic map…')).toContain('<p role="status">Loading live traffic map…</p>')
    expect(renderState('unavailable', 'Traffic statistics are temporarily unavailable. Refresh to try again.'))
        .toContain('<p role="alert">Traffic statistics are temporarily unavailable. Refresh to try again.</p>')
    expect(renderState('loading', 'Loading recent traffic…', 'min-h-0 p-4')).toContain('bg-ui-panel shadow-sm shadow-ui-canvas/10 dark:shadow-ui-canvas/20 min-h-0 p-4')
    expect(renderState('unavailable', 'Recent traffic is temporarily unavailable. Refresh to try again.'))
        .toContain('<p role="alert">Recent traffic is temporarily unavailable. Refresh to try again.</p>')
})
