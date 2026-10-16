import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'bun:test'
import ProfileLinkCard from '../src/components/profile/ProfileLinkCard'

test('profile card preserves its route, label, icon, and desktop classes', () => {
    const markup = renderToStaticMarkup(createElement(ProfileLinkCard, { id: 'user-42' }))

    expect(markup).toContain('href="/profile/user-42"')
    expect(markup).toContain('class="user-icon"')
    expect(markup).toContain('>Profile</h1>')
    expect(markup).toContain('grid h-fit w-fit gap-2 rounded-lg border border-ui-border px-2 py-1')
    expect(markup).toContain('flex justify-between px-10 group cursor-pointer items-center')
})
