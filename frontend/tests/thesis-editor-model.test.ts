// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import type { ThesisDocument } from '../src/utils/thesis'
import { findRecoveries, removeRecoveredDraft, writeRecovery } from '../src/app/thesis/thesisRecovery'
import { createThesisTransport } from '../src/app/thesis/thesisTransport'
import { ThesisUndoHistory } from '../src/app/thesis/thesisUndoHistory'

const document = (body: string, revision = 1): ThesisDocument => ({ title: 'Draft', body, revision })

function installStorage() {
    const previousLocal = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
    const previousSession = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage')
    const localStorage = createStorage()
    const sessionStorage = createStorage()
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: localStorage })
    Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: sessionStorage })
    return {
        localStorage,
        sessionStorage,
        restore() {
            if (previousLocal) Object.defineProperty(globalThis, 'localStorage', previousLocal)
            else Reflect.deleteProperty(globalThis, 'localStorage')
            if (previousSession) Object.defineProperty(globalThis, 'sessionStorage', previousSession)
            else Reflect.deleteProperty(globalThis, 'sessionStorage')
        },
    }
}

function createStorage() {
    const storage = Object.create(null) as Record<string, string> & Storage
    Object.defineProperties(storage, {
        getItem: { value: (key: string) => storage[key] ?? null },
        setItem: { value: (key: string, value: string) => { storage[key] = value } },
        removeItem: { value: (key: string) => { Reflect.deleteProperty(storage, key) } },
    })
    return storage
}

test('undo history groups typing, supports redo, and clears future history after a new edit', () => {
    const states: Array<{ undo: number, redo: number }> = []
    const history = new ThesisUndoHistory(state => states.push(state))
    history.remember(document('initial'), 'body')
    history.remember(document('first edit'), 'body')
    expect(states.at(-1)).toEqual({ undo: 1, redo: 0 })
    expect(history.travel(document('second edit'), 3, false)).toEqual(document('initial', 3))
    expect(history.travel(document('initial', 3), 3, true)).toEqual(document('second edit', 3))
    expect(history.travel(document('second edit'), 3, false)).toEqual(document('initial', 3))
    history.remember(document('initial', 3), 'body')
    expect(states.at(-1)).toEqual({ undo: 1, redo: 0 })
    expect(history.travel(document('new edit'), 3, true)).toBeNull()
    history.clear()
    expect(states.at(-1)).toEqual({ undo: 0, redo: 0 })
})

test('recovery storage separates the current tab, keeps other drafts, and removes only matching saved drafts', () => {
    const storage = installStorage()
    try {
        const prefix = 'hanasand-thesis-recovery:'
        storage.sessionStorage.setItem(prefix, 'current')
        storage.localStorage.setItem(prefix + 'current', JSON.stringify({ ...document('unsaved'), savedAt: 1 }))
        storage.localStorage.setItem(prefix + 'other', JSON.stringify({ ...document('other'), savedAt: 2 }))
        storage.localStorage.setItem(prefix + 'invalid', '{broken')

        const result = findRecoveries(document('server'))
        expect(result.key).toBe(prefix + 'current')
        expect(result.own?.body).toBe('unsaved')
        expect(result.others.map(item => item.body)).toEqual(['other'])

        writeRecovery(result.key, document('saved'), true)
        const saved = JSON.parse(storage.localStorage.getItem(result.key)!)
        removeRecoveredDraft({ ...saved, key: result.key })
        expect(storage.localStorage.getItem(result.key)).toBeNull()

        writeRecovery(result.key, document('newer'), true)
        removeRecoveredDraft({ ...document('older'), key: result.key, savedAt: 1 })
        expect(JSON.parse(storage.localStorage.getItem(result.key)!).body).toBe('newer')
    } finally {
        storage.restore()
    }
})

test('autosave sends the current draft with the base revision and accepts the server revision', async () => {
    const originalFetch = globalThis.fetch
    let draft = document('new body')
    let base = document('old body')
    let request: { url: RequestInfo | URL, init?: RequestInit } | undefined
    let accepted = false
    globalThis.fetch = async (url, init) => {
        request = { url, init }
        return new Response(JSON.stringify(document('new body', 2)), { status: 200 })
    }
    try {
        const transport = createThesisTransport({
            canEdit: true,
            getDraft: () => draft,
            getBase: () => base,
            isDirty: () => draft.body !== base.body,
            hasConflict: () => false,
            receive: next => { base = next; draft = next },
            keepDraft: () => {},
            sentRef: { current: null },
            onConflict: () => {},
            onAccepted: next => { base = next; draft = next },
            onSaved: () => { accepted = true },
            setError: message => { throw new Error(message) },
        })
        expect(await transport.flush()).toBe(true)
        expect(request?.url).toBe('/api/thesis')
        expect(request?.init?.method).toBe('PUT')
        expect(JSON.parse(String(request?.init?.body))).toEqual(document('new body'))
        expect(accepted).toBe(true)
    } finally {
        globalThis.fetch = originalFetch
    }
})

test('autosave conflict blocks further sync until the remote document is resolved', async () => {
    const originalFetch = globalThis.fetch
    let conflicted: ThesisDocument | null = null
    globalThis.fetch = async () => new Response(JSON.stringify(document('remote', 2)), { status: 409 })
    try {
        const transport = createThesisTransport({
            canEdit: true,
            getDraft: () => document('local'),
            getBase: () => document('base'),
            isDirty: () => true,
            hasConflict: () => Boolean(conflicted),
            receive: () => {},
            keepDraft: () => {},
            sentRef: { current: null },
            onConflict: next => { conflicted = next },
            onAccepted: () => {},
            onSaved: () => {},
            setError: message => { throw new Error(message) },
        })
        expect(await transport.flush()).toBe(false)
        expect(conflicted).toEqual(document('remote', 2))
        expect(await transport.flush()).toBe(false)
    } finally {
        globalThis.fetch = originalFetch
    }
})
