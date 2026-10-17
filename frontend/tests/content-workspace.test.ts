// @ts-expect-error Bun provides this module for focused checks.
import { expect, mock, test } from 'bun:test'
import { NextRequest } from 'next/server'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import NotesPanelIconButton from '../src/app/dashboard/notes/NotesPanelIconButton'
import { Search } from 'lucide-react'

let organizationId = 'hanasand'
let denied = false
let lastUrl = ''
let lastHeaders = new Headers()
mock.module('next/headers', () => ({ cookies: async () => ({ get: (name: string) => {
    const values: Record<string, string> = { id: 'member', access_token: 'test-session', hanasand_workspace: JSON.stringify({ userId: 'member', organizationId, name: 'Hanasand' }) }
    return values[name] ? { value: values[name] } : undefined
} }) }))
mock.module('../src/config', () => ({ default: { url: { api: 'https://api.example.test/api' }, abortTimeout: 1000 } }))
globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    lastUrl = String(url); lastHeaders = new Headers(init?.headers)
    return Response.json(denied ? { error: 'Forbidden' } : [], { status: denied ? 403 : 200 })
}) as typeof fetch
const { default: fetchWorkspaceContent } = await import('../src/utils/organizations/fetchWorkspaceContent')
const { GET, POST } = await import('../src/app/api/backend/[...path]/route')

test('content lists read organization from the server-only workspace cookie', async () => {
    await fetchWorkspaceContent('articles')
    expect(lastUrl).toBe('https://api.example.test/api/articles?workspace=true')
    expect(lastHeaders.get('x-organization-id')).toBe('hanasand')
    expect(lastHeaders.get('id')).toBe('member')
    organizationId = ''
    await fetchWorkspaceContent('thoughts')
    expect(lastHeaders.has('x-organization-id')).toBe(false)
    denied = true
    await expect(fetchWorkspaceContent('articles')).rejects.toThrow('Could not load articles.')
    denied = false; organizationId = 'hanasand'
})
test('content proxy uses selected workspace rather than a caller-supplied organization header', async () => {
    for (const kind of ['article', 'thoughts', 'notes', 'share']) {
        const req = new NextRequest(`https://hanasand.com/api/backend/${kind}`, {
            method: 'POST', headers: { 'x-organization-id': 'another-org', 'content-type': 'application/json' }, body: '{}',
        })
        expect((await POST(req, { params: Promise.resolve({ path: [kind] }) })).status).toBe(200)
        expect(lastHeaders.get('x-organization-id')).toBe('hanasand')
    }
    organizationId = ''
    await GET(new NextRequest('https://hanasand.com/api/backend/notes', { headers: { 'x-organization-id': 'forged' } }), { params: Promise.resolve({ path: ['notes'] }) })
    expect(lastHeaders.has('x-organization-id')).toBe(false)
})

test('notes panel icon controls keep their button and accessible label contract', () => {
    const html = renderToStaticMarkup(createElement(NotesPanelIconButton, {
        label: 'Open notes sidebar', onClick: () => undefined,
    }, createElement(Search, { className: 'h-4 w-4' })))

    expect(html).toContain('type="button"')
    expect(html).toContain('aria-label="Open notes sidebar"')
    expect(html).toContain('title="Open notes sidebar"')
    expect(html).toContain('class="ui-button ui-button-secondary h-9 w-9 p-0"')
    expect(html).toContain('<svg')
})
