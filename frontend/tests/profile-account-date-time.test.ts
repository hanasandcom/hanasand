import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { formatAccountDateTime } from '../src/components/profile/formatAccountDateTime'
import SshKeys from '../src/components/profile/sshKeys'

test('account activity dates keep the existing English medium date and short time format', () => {
    const value = '2026-10-17T12:34:00.000Z'
    const expected = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))

    assert.equal(formatAccountDateTime(value), expected)
})

test('SSH key added and last-used dates keep their Oslo formats and missing values', () => {
    const addedAt = '2026-10-17T12:34:00.000Z'
    const expectedDate = new Intl.DateTimeFormat('nb-NO', { dateStyle: 'medium', timeZone: 'Europe/Oslo' }).format(new Date(addedAt))
    const expectedDateTime = new Intl.DateTimeFormat('nb-NO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Oslo' }).format(new Date(addedAt))
    const key = {
        id: 1, name: 'Laptop', fingerprint: 'SHA256:abc', keyType: 'ed25519', addedAt,
        lastUsedServer: null, lastUsedIp: null, lastUsedUserAgent: null,
    }
    const renderKey = (lastUsedAt: string | null) => renderToStaticMarkup(createElement(SshKeys, {
        initialKeys: [{ ...key, lastUsedAt }],
    }))
    const markup = renderKey(addedAt)

    assert.ok(markup.includes(expectedDate))
    assert.ok(markup.includes(expectedDateTime))
    assert.ok(renderKey(null).includes('Not recorded'))
    assert.ok(renderKey('').includes('Unknown'))
    assert.ok(renderKey('invalid date').includes('Unknown'))
})
