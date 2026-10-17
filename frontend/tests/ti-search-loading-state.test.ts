import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { test } from 'bun:test'
import SearchLoading from '../src/app/ti/components/search-loading'

test('public TI loading state uses the standard loader without synthetic evidence', () => {
    const query = renderToStaticMarkup(createElement(SearchLoading, { query: 'APT29' }))
    const empty = renderToStaticMarkup(createElement(SearchLoading, { query: '' }))

    assert.match(query, /role="status" aria-live="polite"/)
    assert.match(query, /Searching “APT29”…/)
    assert.match(query, /animate-spin/)
    assert.match(empty, /Searching threat intelligence…/)
    assert.doesNotMatch(`${query}${empty}`, /confidence|synthetic evidence/i)
})
