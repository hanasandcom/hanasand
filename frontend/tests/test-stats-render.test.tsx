// @ts-expect-error Bun provides this module when running focused tests.
import { expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import TestStatsPageClient from '../src/app/test/stats/pageClient'

test('service check stats renders its search surface with shared theme tokens', () => {
    const html = renderToStaticMarkup(createElement(TestStatsPageClient))

    expect(html).toContain('Service check results')
    expect(html).toContain('text-ui-primary')
    expect(html).toContain('bg-ui-text px-3 text-sm font-semibold text-ui-canvas')
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Search<\/button>/)
    expect(html).toContain('placeholder="Scan id"')
    expect(html).not.toContain('stroke-[#3056d3]')
    expect(html).not.toMatch(/\b(?:bg|text|border|stroke|fill|divide)-\[#/)
})
