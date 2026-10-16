// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ShortcutInput } from '../src/app/g/ShortcutInput'

const render = (required: boolean, error?: string) => renderToStaticMarkup(createElement(ShortcutInput, {
    value: 'team-notes',
    onChange: () => {},
    required,
    error,
}))

test('shortcut creator and lookup share the same controlled accessible field', () => {
    const creator = render(false, 'Use letters, numbers, dashes or underscores.')
    const lookup = render(true)

    for (const html of [creator, lookup]) {
        expect(html).toContain('<label class="grid gap-2"><span class="text-xs font-semibold uppercase text-ui-primary">Shortcut</span>')
        expect(html).toContain('placeholder="team-notes"')
        expect(html).toContain('value="team-notes"')
        expect(html).toContain('class="min-w-0 flex-1 bg-transparent px-3 text-sm text-ui-text outline-none placeholder:text-ui-muted"')
        expect(html).not.toContain('name=')
    }
    expect(creator).not.toContain('required=""')
    expect(creator).toContain('Use letters, numbers, dashes or underscores.')
    expect(lookup).toContain('required=""')
})
