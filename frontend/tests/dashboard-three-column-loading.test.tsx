import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'bun:test'
import DashboardThreeColumnLoading from '../src/app/dashboard/DashboardThreeColumnLoading'

test('findings and TI loading panels preserve their skeleton layout and sizes', () => {
    const render = (props: Parameters<typeof DashboardThreeColumnLoading>[0]) =>
        renderToStaticMarkup(createElement(DashboardThreeColumnLoading, props))
    const findings = render({
        eyebrow: 'Dark web monitoring',
        title: 'Dark web cases',
        description: 'Loading recent attacks, evidence, source health, and delivery state.',
        tabs: ['Cases', 'Active', 'Critical', 'Ready', 'Watchlist', 'Webhook'],
        listItemHeight: 'h-28',
        detailPanelHeight: 'h-80',
        inspectorCardHeight: 'h-52',
    })
    const ti = render({
        eyebrow: 'Threat intelligence',
        title: 'Loading',
        description: 'Loading collection, recent attacks, actor profiles, sources, and review state.',
        tabs: ['Collection', 'Attacks', 'Activity', 'Actors', 'Sources', 'Runs'],
        listItemHeight: 'h-24',
        detailPanelHeight: 'h-72',
        inspectorCardHeight: 'h-44',
    })

    expect(findings).toContain('class="grid min-h-[480px] xl:grid-cols-[320px_minmax(0,1fr)_360px]"')
    expect(findings.match(/h-\[54px\] w-28 animate-pulse rounded-lg border border-ui-border bg-ui-panel/g)).toHaveLength(6)
    expect(findings.match(/h-28 animate-pulse rounded-lg bg-ui-panel/g)).toHaveLength(7)
    expect(findings.match(/h-80 animate-pulse rounded-lg bg-ui-raised/g)).toHaveLength(2)
    expect(findings.match(/h-52 animate-pulse rounded-lg bg-ui-panel/g)).toHaveLength(3)
    expect(ti.match(/h-\[54px\] w-28 animate-pulse rounded-lg border border-ui-border bg-ui-panel/g)).toHaveLength(6)
    expect(ti.match(/h-24 animate-pulse rounded-lg bg-ui-panel/g)).toHaveLength(7)
    expect(ti.match(/h-72 animate-pulse rounded-lg bg-ui-raised/g)).toHaveLength(2)
    expect(ti.match(/h-44 animate-pulse rounded-lg bg-ui-panel/g)).toHaveLength(3)
})
