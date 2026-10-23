import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { Header, Sidebar } from '../src/index.js'

describe('shared application chrome', () => {
    test('renders local brand art and labelled links to Hanasand apps', () => {
        const markup = renderToStaticMarkup(<Header logoSrc='/assets/logo.png' />)

        expect(markup).toContain('src="/assets/logo.png"')
        expect(markup).toContain('aria-label="Hanasand services"')
        expect(markup).toContain('https://mail.hanasand.com')
        expect(markup).toContain('https://cdn.hanasand.com')
    })

    test('preserves a host app sidebar label and attributes', () => {
        const markup = renderToStaticMarkup(<Sidebar aria-label='Dashboard sidebar' className='app-sidebar'><nav /></Sidebar>)

        expect(markup).toContain('<aside aria-label="Dashboard sidebar" class="app-sidebar">')
        expect(markup).toContain('<nav></nav>')
    })

    test('drops unsafe service destinations before rendering links', () => {
        const markup = renderToStaticMarkup(<Header links={[
            { href: 'javascript:alert(1)', label: 'Bad' },
            { href: '//attacker.example', label: 'Protocol relative' },
            { href: '/login', label: 'Local login' },
        ]} />)

        expect(markup).not.toContain('javascript:')
        expect(markup).not.toContain('attacker.example')
        expect(markup).toContain('href="/login"')
    })
})
