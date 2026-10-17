// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Activity } from 'lucide-react'
import { Metric } from '../src/app/dashboard/ti/dashboardPresentation'
import DashboardMetricCard from '../src/components/dashboard/dashboardMetricCard'

const render = (props: Parameters<typeof Metric>[0]) => renderToStaticMarkup(createElement(Metric, props))

test('shared dashboard metric retains overview and activity page styles', () => {
    const overview = render({ title: 'Events', value: 'ready now', icon: createElement(Activity) })
    expect(overview).toContain('text-xl font-semibold capitalize text-ui-text')
    expect(overview).toContain('>ready now</p>')

    const activity = render({ title: 'Last event', value: 'No events yet', icon: createElement(Activity), valueSize: 'large', tone: 'watch' })
    expect(activity).toContain('text-2xl font-semibold text-ui-text')
    expect(activity).not.toContain('capitalize')
    expect(activity).toContain('text-ui-warning')
    expect(activity).toContain('>No events yet</p>')
    expect(activity).toContain('>Last event</p>')
    expect(activity).toContain('bg-ui-panel p-4')
})

test('compact shared metric preserves management summary card layout', () => {
    const markup = renderToStaticMarkup(createElement(DashboardMetricCard, {
        density: 'compact', tone: 'neutral', label: 'Users', value: '12', detail: 'Registered accounts', icon: createElement('span', null, 'icon'),
    }))

    expect(markup).toBe('<section class="rounded-lg border border-ui-border bg-ui-panel shadow-sm shadow-ui-canvas/10 dark:shadow-ui-canvas/20 border-ui-border bg-ui-panel p-3"><div class="flex items-center justify-between gap-3"><span class="text-sm text-ui-muted">Users</span><span class="text-ui-muted"><span>icon</span></span></div><div class="mt-1 text-xl font-medium text-ui-text">12</div><p class="mt-1 text-xs text-ui-muted">Registered accounts</p></section>')
})
