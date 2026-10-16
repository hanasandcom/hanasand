// @ts-expect-error Bun provides this module when running tests.
import { mock, test, expect } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

let cookieValues: Record<string, string | undefined> = {}
let sharesValue: unknown = []
const receivedProps: Record<string, unknown>[] = []
const calls: Array<{ name: string, value?: unknown }> = []
let pendingCookies: Promise<unknown> | null = null

mock.module('next/headers', () => ({
    cookies: async () => {
        calls.push({ name: 'cookies' })
        if (pendingCookies) await pendingCookies
        return { get: (name: string) => ({ value: cookieValues[name] }) }
    },
}))
mock.module('@/utils/share/getUserShares', () => ({
    getUserShares: async (input: unknown) => {
        calls.push({ name: 'shares', value: input })
        return sharesValue
    },
}))
mock.module('@/utils/ai/getWorkspace', () => ({
    getAiWorkspace: async (input: unknown) => {
        calls.push({ name: 'workspace', value: input })
        return {
            conversations: [{ id: 'conversation-1' }],
            repositories: [{ id: 'repository-1' }],
            deployments: [{ id: 'deployment-1' }],
            releases: [{ id: 'release-1' }],
            deployQuota: { available: 2 },
            ownershipSummary: { owned: 1 },
            runtimeState: { state: 'ready' },
        }
    },
}))
mock.module('../src/app/ai/pageClient', () => ({
    default: (props: Record<string, unknown>) => {
        receivedProps.push(props)
        return createElement('div', { 'data-ai-workspace': 'ready' })
    },
}))

const { default: AIPage } = await import('../src/app/ai/page')
const { default: AIWindowPage } = await import('../src/app/ai/window/page')
const { default: AIConversationPage } = await import('../src/app/ai/[id]/page')

function resetState() {
    cookieValues = { id: 'user-1', access_token: 'token-1' }
    sharesValue = [{ id: 'share-1' }]
    pendingCookies = null
    calls.length = 0
    receivedProps.length = 0
}

function currentProps() {
    const props = receivedProps.at(-1)
    if (!props) throw new Error('AIPageClient did not render')
    return props
}

test('all workspace routes pass the same server data and preserve route selection', async () => {
    resetState()
    expect(renderToStaticMarkup(await AIPage())).toContain('data-ai-workspace="ready"')
    const indexProps = currentProps()
    expect(indexProps.mode).toBe('workspace')
    expect(indexProps.initialConversations).toEqual([{ id: 'conversation-1' }])
    expect(indexProps.initialRepositories).toEqual([{ id: 'repository-1' }])
    expect(indexProps.initialDeployments).toEqual([{ id: 'deployment-1' }])
    expect(indexProps.initialReleases).toEqual([{ id: 'release-1' }])
    expect(indexProps.initialDeployQuota).toEqual({ available: 2 })
    expect(indexProps.initialOwnershipSummary).toEqual({ owned: 1 })
    expect(indexProps.initialRuntimeState).toEqual({ state: 'ready' })
    expect(indexProps.initialShares).toEqual([{ id: 'share-1' }])
    expect(indexProps.isAuthenticated).toBe(true)
    expect(indexProps).not.toHaveProperty('initialConversationId')

    renderToStaticMarkup(await AIWindowPage())
    expect(currentProps()).not.toHaveProperty('initialConversationId')
    renderToStaticMarkup(await AIConversationPage({ params: Promise.resolve({ id: 'conversation-2' }) }))
    expect(currentProps().initialConversationId).toBe('conversation-2')
    expect(currentProps().mode).toBe('workspace')
})

test('conversation params and cookies resolve in parallel; missing auth skips share loading', async () => {
    resetState()
    let resolveCookies!: () => void
    pendingCookies = new Promise<void>(resolve => { resolveCookies = resolve })
    let resolveParams!: (value: { id: string }) => void
    const params = new Promise<{ id: string }>(resolve => { resolveParams = resolve })
    const page = AIConversationPage({ params })

    expect(calls.map(call => call.name)).toEqual(['cookies'])
    cookieValues = { id: 'user-2' }
    resolveCookies()
    await Promise.resolve()
    expect(calls.map(call => call.name)).toEqual(['cookies'])
    resolveParams({ id: 'conversation-3' })
    renderToStaticMarkup(await page)

    expect(calls.map(call => call.name)).toEqual(['cookies', 'workspace'])
    expect(calls.at(-1)?.value).toEqual({ id: 'user-2', token: undefined })
    expect(currentProps().isAuthenticated).toBe(false)
    expect(currentProps().initialShares).toEqual([])
    expect(currentProps().initialConversationId).toBe('conversation-3')
})
