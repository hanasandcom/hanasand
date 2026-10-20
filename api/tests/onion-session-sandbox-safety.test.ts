import assert from 'node:assert/strict'
import test from 'node:test'
import { sandboxRequestSafety } from '../src/handlers/onionSession/sandboxSafety.ts'

test('onion targets skip host DNS only in Tor mode', async () => {
    let dnsLookups = 0
    const resolver = async () => {
        dnsLookups++
        return [{ address: '127.0.0.1', family: 4 }]
    }
    const target = 'http://p53lf57qbcph367w7g4i57ctv7hlfssgmqb6e6g3m7654g6wb27w36yd.onion/path'

    assert.deepEqual(await sandboxRequestSafety(target, 'tor', resolver), { ok: true })
    assert.deepEqual(await sandboxRequestSafety(target, 'regular', resolver), {
        ok: false,
        reason: 'onion addresses require Tor routing',
    })
    assert.equal(dnsLookups, 0, 'onion hostnames must be resolved by the Tor SOCKS proxy')
})

test('ordinary hostnames still reject private DNS answers', async () => {
    const result = await sandboxRequestSafety('https://example.com/', 'regular', async () => [
        { address: '127.0.0.1', family: 4 },
    ])

    assert.deepEqual(result, { ok: false, reason: 'hostname resolves to private or local network address' })
})
