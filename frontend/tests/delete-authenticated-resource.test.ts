// @ts-expect-error Bun provides this test module at runtime.
import { afterEach, beforeEach, expect, test } from 'bun:test'
import deleteArticle from '../src/utils/articles/deleteArticle'
import deleteProject from '../src/utils/projects/deleteProject'
import deleteThought from '../src/utils/thoughts/deleteThought'
import deleteUser from '../src/utils/users/deleteUser'

const originalFetch = globalThis.fetch
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
const requests: Array<{ url: string, headers: HeadersInit | undefined }> = []

beforeEach(() => {
    requests.length = 0
    Object.defineProperty(globalThis, 'document', { configurable: true, value: { cookie: 'access_token=token-1; id=owner-1' } })
    globalThis.fetch = async(input, init) => {
        requests.push({ url: String(input), headers: init?.headers })
        return new Response(null, { status: 204 })
    }
})

afterEach(() => {
    globalThis.fetch = originalFetch
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument)
    else Reflect.deleteProperty(globalThis, 'document')
})

test('resource deletions keep the target id separate from the authenticated user id', async() => {
    const results = await Promise.all([
        deleteArticle('article-7'),
        deleteProject('project-8'),
        deleteThought('thought-9'),
        deleteUser('user-10'),
    ])

    expect(requests.map(request => request.url)).toEqual(expect.arrayContaining([
        expect.stringMatching(/\/article\/article-7$/),
        expect.stringMatching(/\/project\/project-8$/),
        expect.stringMatching(/\/thought\/thought-9$/),
        expect.stringMatching(/\/user\/user-10$/),
    ]))
    expect(requests.every(request => (request.headers as Record<string, string>).id === 'owner-1')).toBe(true)
    expect(results.map(result => result.message)).toEqual([
        'Deleted article article-7.',
        'Deleted project project-8.',
        'Deleted thought thought-9.',
        'Deleted user user-10.',
    ])
})
