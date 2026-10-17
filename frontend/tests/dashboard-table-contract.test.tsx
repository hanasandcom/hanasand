import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
// @ts-expect-error Bun provides this module when running focused tests.
import { test } from 'bun:test'
import { DashboardTable } from '../src/components/dashboard/ui'

test('shared dashboard tables preserve case and delivery DOM contracts', () => {
    const cases = renderToStaticMarkup(createElement(DashboardTable, {
        className: 'min-w-[48rem] w-full text-left text-sm',
        headClassName: 'sticky top-0 z-10 border-y border-ui-border bg-ui-raised text-ui-muted',
        bodyClassName: 'divide-y divide-ui-border',
        columnHeaders: createElement('th', { scope: 'col', className: 'p-4' }, 'Case'),
    }, createElement('tr', { className: 'text-ui-text' }, createElement('td', { className: 'p-4' }, 'Example case'))))
    assert.equal(cases, '<table class="min-w-[48rem] w-full text-left text-sm"><thead class="sticky top-0 z-10 border-y border-ui-border bg-ui-raised text-ui-muted"><tr><th scope="col" class="p-4">Case</th></tr></thead><tbody class="divide-y divide-ui-border"><tr class="text-ui-text"><td class="p-4">Example case</td></tr></tbody></table>')

    const findings = renderToStaticMarkup(createElement('div', { 'data-dwm-cases-table': 'true' }, createElement(DashboardTable, {
        className: 'min-w-full border-collapse text-left text-sm',
        headClassName: 'border-b border-ui-border bg-ui-raised text-xs font-semibold text-ui-muted',
        bodyClassName: 'divide-y divide-ui-border',
        columnHeaders: createElement('th', { className: 'px-4 py-3' }, 'Title / actor'),
    }, createElement('tr', { 'data-dwm-case-row': 'true' }, createElement('td', null, 'Example case')))))
    assert.equal(findings, '<div data-dwm-cases-table="true"><table class="min-w-full border-collapse text-left text-sm"><thead class="border-b border-ui-border bg-ui-raised text-xs font-semibold text-ui-muted"><tr><th class="px-4 py-3">Title / actor</th></tr></thead><tbody class="divide-y divide-ui-border"><tr data-dwm-case-row="true"><td>Example case</td></tr></tbody></table></div>')

    const delivery = renderToStaticMarkup(createElement('div', { className: 'overflow-x-auto', 'aria-busy': true }, createElement(DashboardTable, {
        className: 'w-full min-w-[44rem] text-left text-sm',
        headClassName: 'bg-ui-raised text-xs text-ui-muted',
        bodyClassName: 'divide-y divide-ui-border',
        columnHeaders: createElement('th', { scope: 'col', className: 'px-4 py-3 font-semibold' }, 'Name'),
    }, createElement('tr', null, createElement('td', { colSpan: 6, className: 'px-4 py-10 text-center text-ui-muted' }, 'No delivery destinations yet.')))))
    assert.equal(delivery, '<div class="overflow-x-auto" aria-busy="true"><table class="w-full min-w-[44rem] text-left text-sm"><thead class="bg-ui-raised text-xs text-ui-muted"><tr><th scope="col" class="px-4 py-3 font-semibold">Name</th></tr></thead><tbody class="divide-y divide-ui-border"><tr><td colSpan="6" class="px-4 py-10 text-center text-ui-muted">No delivery destinations yet.</td></tr></tbody></table></div>')
})
