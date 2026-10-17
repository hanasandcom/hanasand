import { afterEach, expect, mock, test } from 'bun:test'
import config from '../src/config'
import { sendViaWorkspaceApi } from '../src/utils/box/requestTool'

const originalFetch = globalThis.fetch

afterEach(() => {
    globalThis.fetch = originalFetch
})

test('workspace API request preserves the authenticated request contract', async () => {
    const response = { status: 201, body: '{"ok":true}' }
    const fetchMock = mock(async () => ({ json: async () => response }) as Response)
    globalThis.fetch = fetchMock as typeof fetch
    const request = { method: 'PATCH', url: 'https://example.test/items/1', headers: { Accept: 'application/json' }, body: '{"name":"Ada"}' }

    await expect(sendViaWorkspaceApi(request, 'user-id', 'access-token')).resolves.toEqual(response)
    expect(fetchMock).toHaveBeenCalledWith(`${config.url.api}/tools/http/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', id: 'user-id', Authorization: 'Bearer access-token' },
        body: JSON.stringify(request),
    })
})

test('workspace API request returns the established fallback for malformed JSON', async () => {
    const fetchMock = mock(async () => ({ json: async () => { throw new SyntaxError('invalid JSON') } }) as unknown as Response)
    globalThis.fetch = fetchMock as typeof fetch

    await expect(sendViaWorkspaceApi({ method: 'GET', url: '/health', headers: {}, body: '' }, 'user-id', 'access-token'))
        .resolves.toEqual({ error: 'Invalid response.' })
})
