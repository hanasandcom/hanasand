import { expect, test } from 'bun:test'
import { Children, createElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { RefreshCcw } from 'lucide-react'
import { ContainerActionGroup } from '../src/app/dashboard/system/client/ContainerActionGroup'

const icon = createElement('span', { className: 'leading-icon' })

test('container table actions keep compact labels, order, and button styling', () => {
    const html = renderToStaticMarkup(createElement(ContainerActionGroup, {
        variant: 'compact',
        displayName: 'API',
        leading: { label: 'Inspect API', icon, onClick: () => {} },
        onCopy: () => {},
        onRestart: () => {},
    }))

    expect(html).toContain('class="flex justify-end gap-1"')
    expect(html).toContain('aria-label="Inspect API" title="Inspect API"')
    expect(html).toContain('aria-label="Copy API" title="Copy API"')
    expect(html).toContain('aria-label="Restart API" title="Restart API"')
    expect(html.indexOf('Inspect API')).toBeLessThan(html.indexOf('Copy API'))
    expect(html.indexOf('Copy API')).toBeLessThan(html.indexOf('Restart API'))
    expect(html).toContain('grid h-8 w-8 place-items-center rounded-md border border-ui-border')
})

test('selected-container actions keep their text labels, leading icon, and warning restart style', () => {
    const html = renderToStaticMarkup(createElement(ContainerActionGroup, {
        variant: 'full',
        leading: { label: 'Logs', icon: createElement(RefreshCcw, { className: 'h-4 w-4 animate-spin' }), onClick: () => {} },
        onCopy: () => {},
        onRestart: () => {},
    }))

    expect(html).toContain('class="mt-3 flex flex-wrap gap-2"')
    expect(html).toContain('h-9 items-center gap-2 rounded-md border border-ui-border bg-ui-panel px-3 text-sm font-semibold text-ui-text shadow-sm hover:bg-ui-raised')
    expect(html).toContain('lucide-refresh-ccw h-4 w-4 animate-spin')
    expect(html).toContain('>Logs</button>')
    expect(html).toContain('>Copy</button>')
    expect(html).toContain('border-ui-warning/35 bg-ui-warning/10 px-3 text-sm font-semibold text-ui-warning')
    expect(html.indexOf('>Logs</button>')).toBeLessThan(html.indexOf('>Copy</button>'))
    expect(html.indexOf('>Copy</button>')).toBeLessThan(html.indexOf('>Restart</button>'))
})

test('compact and full actions dispatch to their matching callbacks in display order', () => {
    const calls: string[] = []
    const variants = [
        createElement(ContainerActionGroup, {
            variant: 'compact',
            displayName: 'API',
            leading: { label: 'Inspect API', icon, onClick: () => calls.push('inspect') },
            onCopy: () => calls.push('copy'),
            onRestart: () => calls.push('restart'),
        }),
        createElement(ContainerActionGroup, {
            variant: 'full',
            leading: { label: 'Logs', icon, onClick: () => calls.push('logs') },
            onCopy: () => calls.push('copy details'),
            onRestart: () => calls.push('restart details'),
        }),
    ]

    for (const variant of variants) {
        const rendered = variant.type(variant.props) as ReactElement<{ children: ReactNode }>
        const actions = Children.toArray(rendered.props.children)
            .filter(isValidElement)
            .map(action => (action as ReactElement<{ onClick: () => void }>).props.onClick)
        actions.forEach(action => action())
    }

    expect(calls).toEqual(['inspect', 'copy', 'restart', 'logs', 'copy details', 'restart details'])
})
