import { expect, test } from 'bun:test'
import { browserResultId } from '../../src/utils/ws/browserResultIdentity.ts'
import { handlers, response, state } from './fixture.ts'

test('latest and older runs load without expiry, with stored screenshots and text', async () => {
    for (const run of [undefined, 'old']) {
        const res = response()
        await handlers.getBrowserResult({ params: { id: browserResultId('https://vg.no/') }, query: { run }, log: { error: console.error } } as any, res as any)
        expect(res.code).toBe(200)
        expect(res.body.runId).toBe(run || 'new')
        expect(res.body.runs).toHaveLength(2)
        expect(res.body.captures[0]).toMatchObject({ image: 'data:image/jpeg;base64,saved-image', evidence: { textExcerpt: 'Full captured text', sourceCode: '<main>Full source</main>' } })
    }
})

test('knowing the stable URL ID does not grant access to another user’s runs', async () => {
    state.userId = 'other'
    const res = response()
    await handlers.getBrowserResult({ params: { id: browserResultId('https://vg.no') }, query: {}, log: { error: console.error } } as any, res as any)
    expect(res.code).toBe(404)
})

test('a version from outside the accessible URL history is rejected', async () => {
    const res = response()
    await handlers.getBrowserResult({ params: { id: browserResultId('https://vg.no') }, query: { run: 'foreign' }, log: { error: console.error } } as any, res as any)
    expect(res.code).toBe(404)
})
