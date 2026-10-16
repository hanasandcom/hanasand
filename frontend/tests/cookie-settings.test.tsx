import { expect, mock, test } from 'bun:test'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
    clearKeys,
    emptySnapshot,
    friendlyKey,
    readSnapshot,
} from '../src/app/cookie-settings/storageSnapshot'

mock.module('next/link', () => ({
    default: ({ href, children }: { href: string, children: ReactNode }) =>
        createElement('a', { href }, children),
}))

const { default: CookieSettingsClient } = await import('../src/app/cookie-settings/pageClient')

function memoryStorage(initialKeys: string[]): Storage {
    const entries = new Set(initialKeys)
    return {
        get length() { return entries.size },
        key(index: number) { return [...entries][index] ?? null },
        removeItem(key: string) { entries.delete(key) },
        getItem() { return null },
        setItem() {},
        clear() { entries.clear() },
    }
}

test('storage snapshot includes consent, auth presence, and product keys only', () => {
    const snapshot = readSnapshot({
        cookieString: 'hanasand_cookie_consent=optional; hanasand_cookie_consent_updated_at=2026-10-01T12%3A00%3A00Z; access_token=secret; impersonation_token=secret; theme=dark',
        localStorage: memoryStorage(['hanasand.share.workspace', 'unrelated.preference', 'hanasand:ti-cache']),
        sessionStorage: memoryStorage(['hanasand.ai.draft']),
    })

    expect(snapshot.consent).toBe('optional')
    expect(snapshot.consentUpdatedAt).toBe('2026-10-01T12:00:00Z')
    expect(snapshot.sessionToken).toBe(true)
    expect(snapshot.impersonationToken).toBe(true)
    expect(snapshot.localProductKeys).toEqual(['hanasand.share.workspace', 'hanasand:ti-cache'])
    expect(snapshot.sessionProductKeys).toEqual(['hanasand.ai.draft'])
})

test('storage clearing continues after one key fails and labels remain readable', () => {
    const removed: string[] = []
    const storage = {
        removeItem(key: string) {
            if (key === 'locked') throw new Error('blocked by browser policy')
            removed.push(key)
        },
    } as Storage

    expect(clearKeys(['locked', 'hanasand.share.git.token.v2'], storage)).toBe(1)
    expect(removed).toEqual(['hanasand.share.git.token.v2'])
    expect(friendlyKey('hanasand.share.git.token.v2')).toBe('share git token')
    expect(emptySnapshot().consent).toBe('unset')
})

test('settings page renders consent choices, protected-token summary, and sign-out link', () => {
    const html = renderToStaticMarkup(createElement(CookieSettingsClient))

    expect(html).toContain('Cookie settings')
    expect(html).toContain('Allow optional')
    expect(html).toContain('Essential only')
    expect(html).toContain('Reset choice')
    expect(html).toContain('Session token')
    expect(html).toContain('Support session token')
    expect(html).toContain('href="/logout"')
    expect(html).toContain('Clear local tokens')
})
