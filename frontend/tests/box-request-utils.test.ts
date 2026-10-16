import assert from 'node:assert/strict'
import { test } from 'bun:test'
import { parseCurlCommand } from '../src/components/box/curlImport'
import { buildRequestHeaders, buildVariablePlan, findMissingVariables, normalizeHeaderRows, normalizeVariableRows, resolveTemplate } from '../src/components/box/requestTemplates'
import { formatJsonTree, formatPrettyResponseBody, formatRawResponseBody } from '../src/components/box/responseFormatting'
import { getImagePreviewUrl } from '../src/components/box/responsePreview'
import { redactSensitiveText, sanitizeToolResponse } from '../src/components/box/responseSafety'
import type { ToolResponse } from '../src/components/box/types'

test('normalizes request rows and resolves valid scoped variables', () => {
    assert.deepEqual(normalizeHeaderRows([{ key: 'Accept' }, null, { key: 3 }]), [{ key: 'Accept', value: '' }])
    assert.deepEqual(normalizeVariableRows([{ key: 'host', value: 7 }]), [{ key: 'host', value: '' }])
    const plan = buildVariablePlan([{ key: 'baseUrl', value: ' https://api.example.com ' }, { key: 'bad key', value: 'x' }])
    assert.deepEqual(plan.values, { baseUrl: 'https://api.example.com' })
    assert.deepEqual(plan.warnings, ['Skipped invalid variable name: bad key.'])
    assert.equal(resolveTemplate('{{baseUrl}}/v1', plan.values), 'https://api.example.com/v1')
    assert.deepEqual(findMissingVariables('{{missing}} {{missing}}', plan.values), ['Missing variable: missing.'])
    assert.deepEqual(buildRequestHeaders([{ key: ' Authorization ', value: ' Bearer {{token}} ' }, { key: 'Empty', value: '' }], { token: 'secret' }), { Authorization: 'Bearer secret' })
})

test('imports cURL method, quoted URL, headers, and body', () => {
    assert.deepEqual(parseCurlCommand('curl \'https://api.example.com/v1/users\' -H \'X-Test: yes\' --data-raw \'{"name":"Ada"}\''), {
        method: 'POST', url: 'https://api.example.com/v1/users', headers: [{ key: 'X-Test', value: 'yes' }], body: '{"name":"Ada"}',
    })
    assert.equal(parseCurlCommand('https://api.example.com'), null)
    assert.deepEqual(parseCurlCommand('curl -X delete https://api.example.com/users/1'), { method: 'DELETE', url: 'https://api.example.com/users/1', headers: [{ key: '', value: '' }], body: '' })
})

test('formats response views and redacts credentials without changing request payloads', () => {
    const response: ToolResponse = { status: 200, body: '{"ok":true}', warnings: ['safe'], headers: { 'Content-Type': 'application/json', Authorization: 'Bearer secret' }, request: { method: 'GET', url: 'https://api.example.com/image.png', headers: { Cookie: 'session', Accept: 'application/json' }, body: '' } }
    assert.match(formatPrettyResponseBody(response), /"ok": true/)
    assert.match(formatRawResponseBody(response), /^Warnings:/)
    assert.equal(formatJsonTree(response), '$.ok = true')
    assert.equal(getImagePreviewUrl(response, response.request!.url), response.request!.url)
    const safe = sanitizeToolResponse(response)
    assert.equal(safe.headers?.Authorization, '[redacted]')
    assert.equal(safe.request?.headers.Cookie, '[redacted]')
    assert.equal(safe.request?.headers.Accept, 'application/json')
    assert.equal(redactSensitiveText('Authorization: Bearer token'), 'Authorization: Bearer [redacted]')
})
