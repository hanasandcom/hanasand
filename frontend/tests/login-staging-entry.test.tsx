import { expect, mock, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const redirects: string[] = []
mock.module('next/navigation', () => ({
    redirect: (url: string) => {
        redirects.push(url)
        throw new Error('redirect')
    },
}))
mock.module('../src/app/login/pageClient', () => ({
    default: (props: Record<string, unknown>) => createElement('div', {
        'data-stage-local-auth': String(props.stageLocalAuth),
        'data-path': String(props.path),
        'data-expired': String(props.serverExpired),
    }),
}))

const { default: LoginEntryPage } = await import('../src/app/login/page')

test('staging renders the local login page while production keeps the Identity redirect', async () => {
    const previous = process.env.HANASAND_STAGING_LOCAL_AUTH_UI
    try {
        process.env.HANASAND_STAGING_LOCAL_AUTH_UI = '1'
        redirects.length = 0
        const staged = await LoginEntryPage({ searchParams: Promise.resolve({ path: '/ai', expired: 'true' }) })
        const html = renderToStaticMarkup(staged)
        expect(html).toContain('data-stage-local-auth="true"')
        expect(html).toContain('data-path="/ai"')
        expect(html).toContain('data-expired="true"')
        expect(redirects).toHaveLength(0)

        delete process.env.HANASAND_STAGING_LOCAL_AUTH_UI
        await expect(LoginEntryPage({ searchParams: Promise.resolve({ path: '/ai' }) })).rejects.toThrow('redirect')
        expect(redirects.at(-1)).toBe('https://identity.hanasand.com/login?returnTo=https%3A%2F%2Fhanasand.com%2Fai')
    } finally {
        if (previous === undefined) delete process.env.HANASAND_STAGING_LOCAL_AUTH_UI
        else process.env.HANASAND_STAGING_LOCAL_AUTH_UI = previous
    }
})
