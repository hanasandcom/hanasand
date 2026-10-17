// @ts-expect-error Bun provides this module when running tests.
import { mock, test, expect } from 'bun:test'
import { createElement, type ComponentProps, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

let organizationId = 'org-a'
mock.module('@/components/organizations/workspaceProvider', () => ({ useWorkspace: () => ({ organizationId }) }))
mock.module('next/link', () => ({
    default: ({ href, children, ...props }: ComponentProps<'a'> & { children?: ReactNode }) => createElement('a', { ...props, href }, children),
}))

const { default: WorkspaceLink } = await import('../src/components/organizations/workspaceLink')

function renderLink(href: string) {
    return renderToStaticMarkup(createElement(WorkspaceLink, { href, children: 'Open' }))
}

test('workspace links clean redundant tenant scope and preserve selected subject context', () => {
    expect(renderLink('/cases/case-1?organizationId=org-a&tenantId=tenant-a&tab=notes#evidence'))
        .toContain('href="/cases/case-1?tab=notes#evidence"')
    expect(renderLink('/cases/case-1?organizationId=org%2Fb&tenantId=tenant-a&tab=notes#evidence'))
        .toContain('href="/cases/case-1?tab=notes&amp;org=org%2Fb#evidence"')
})

test('workspace links leave API, public, and external destinations unchanged', () => {
    expect(renderLink('/api/cases?organizationId=org-b&tenantId=tenant-b'))
        .toContain('href="/api/cases?organizationId=org-b&amp;tenantId=tenant-b"')
    expect(renderLink('/login?organizationId=org-b'))
        .toContain('href="/login?organizationId=org-b"')
    expect(renderLink('https://external.example/path?org=org-b'))
        .toContain('href="https://external.example/path?org=org-b"')
})

test('workspace links clean scope when no organization is selected', () => {
    organizationId = ''
    expect(renderLink('/rules?orgId=org-b&tenantId=tenant-b&filter=active'))
        .toContain('href="/rules?filter=active&amp;org=org-b"')
    expect(renderLink('/rules?tenantId=tenant-b&filter=active'))
        .toContain('href="/rules?filter=active"')
})
