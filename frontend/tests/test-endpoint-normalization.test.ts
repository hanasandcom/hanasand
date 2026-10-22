import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isValidEndpoint, normalizeEndpoint } from '../src/utils/test/normalizeEndpoint'

test('scheme-less hostnames default to HTTPS', () => {
    const endpoint = normalizeEndpoint('status.hanasand.com')
    assert.equal(endpoint, 'https://status.hanasand.com')
    assert.equal(isValidEndpoint(endpoint), true)
})

test('explicit HTTP and HTTPS schemes are preserved', () => {
    assert.equal(normalizeEndpoint(' http://status.hanasand.com/health '), 'http://status.hanasand.com/health')
    assert.equal(normalizeEndpoint('https://status.hanasand.com'), 'https://status.hanasand.com')
})

test('unsupported schemes and malformed endpoints remain invalid', () => {
    assert.equal(isValidEndpoint(normalizeEndpoint('ftp://status.hanasand.com')), false)
    assert.equal(isValidEndpoint(normalizeEndpoint('not a host')), false)
})
