import assert from 'node:assert/strict'
import test from 'node:test'
import type { SessionState } from '../src/handlers/onionSession/sessionState.ts'
import { createNavigationService } from '../src/handlers/onionSession/navigationService.ts'

test('Tor navigation succeeds at response commit without waiting for DOMContentLoaded', async () => {
    let navigationOptions: unknown
    let queuedBody = ''
    let frameSent = false
    const state = {
        network: 'tor',
        runGeneration: 1,
        currentRunId: null,
        downloadTargets: new Set<string>(),
        page: {
            goto: async (_target: string, options: unknown) => {
                navigationOptions = options
                return { headers: () => ({ 'content-type': 'text/html' }), text: async () => '<html></html>' }
            },
        },
    } as unknown as SessionState
    const service = createNavigationService({
        state,
        sessionId: 'test-session',
        defaultNetwork: 'tor',
        send: () => undefined,
        isCurrentRun: () => true,
        sendFrame: async () => { frameSent = true },
        queueDocumentEvidence: async body => { queuedBody = await body },
    })

    await service.navigate('http://p53lf57qbcph367w7g4i57ctv7hlfssgmqb6e6g3m7654g6wb27w36yd.onion/')

    assert.deepEqual(navigationOptions, { waitUntil: 'commit', timeout: 25_000 })
    assert.equal(queuedBody, '<html></html>')
    assert.equal(frameSent, true)
})
