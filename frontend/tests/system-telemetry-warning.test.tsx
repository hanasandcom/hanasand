import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
// @ts-expect-error Bun provides this module when running focused tests.
import { test } from 'bun:test'
import { TelemetryWarning } from '../src/app/dashboard/system/client/SystemUi'

test('system telemetry warning preserves source-specific degraded status markup', () => {
    const docker = renderToStaticMarkup(createElement(TelemetryWarning, {
        source: 'Docker',
        reason: 'stream reconnecting',
    }))
    const host = renderToStaticMarkup(createElement(TelemetryWarning, {
        source: 'Host',
        reason: 'agent unavailable',
    }))

    assert.equal(docker, '<p class="rounded-md border border-ui-warning/35 bg-ui-warning/10 px-3 py-2 text-sm text-ui-warning">Docker telemetry degraded: stream reconnecting</p>')
    assert.equal(host, '<p class="rounded-md border border-ui-warning/35 bg-ui-warning/10 px-3 py-2 text-sm text-ui-warning">Host telemetry degraded: agent unavailable</p>')
})
