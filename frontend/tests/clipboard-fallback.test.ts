import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import type { Dispatch, SetStateAction } from 'react'
import { copyTextToClipboard } from '../src/utils/copyTextToClipboard'
import copy from '../src/utils/copy'

function replaceGlobal(name: string, value: unknown) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name)
    Object.defineProperty(globalThis, name, { configurable: true, value })
    return () => previous ? Object.defineProperty(globalThis, name, previous) : Reflect.deleteProperty(globalThis, name)
}

test('clipboard API success skips the textarea fallback', async () => {
    let created = false
    const restoreNavigator = replaceGlobal('navigator', { clipboard: { writeText: async (value: string) => assert.equal(value, 'payload') } })
    const restoreDocument = replaceGlobal('document', { createElement: () => { created = true; throw new Error('unexpected fallback') } })
    try {
        assert.equal(await copyTextToClipboard('payload'), true)
        assert.equal(created, false)
    } finally {
        restoreDocument()
        restoreNavigator()
    }
})

test('clipboard fallback selects and removes its hidden textarea and returns execCommand result', async () => {
    let appended = false
    let removed = false
    let selected = false
    const textarea = { value: '', style: {} as Record<string, string>, select: () => { selected = true }, remove: () => { removed = true } }
    const restoreNavigator = replaceGlobal('navigator', { clipboard: { writeText: async () => { throw new Error('unavailable') } } })
    const restoreDocument = replaceGlobal('document', {
        createElement: (tag: string) => { assert.equal(tag, 'textarea'); return textarea },
        body: { appendChild: () => { appended = true } },
        execCommand: (command: string) => { assert.equal(command, 'copy'); return true },
    })
    try {
        assert.equal(await copyTextToClipboard('fallback payload'), true)
        assert.equal(textarea.value, 'fallback payload')
        assert.equal(textarea.style.position, 'fixed')
        assert.equal(textarea.style.opacity, '0')
        assert.equal(appended && selected && removed, true)
    } finally {
        restoreDocument()
        restoreNavigator()
    }
})

test('clipboard fallback removes its textarea when execCommand throws', async () => {
    let removed = false
    const restoreNavigator = replaceGlobal('navigator', { clipboard: { writeText: async () => { throw new Error('unavailable') } } })
    const restoreDocument = replaceGlobal('document', {
        createElement: () => ({ value: '', style: {}, select: () => {}, remove: () => { removed = true } }),
        body: { appendChild: () => {} },
        execCommand: () => { throw new Error('copy failed') },
    })
    try {
        assert.equal(await copyTextToClipboard('fallback payload'), false)
        assert.equal(removed, true)
    } finally {
        restoreDocument()
        restoreNavigator()
    }
})

test('clipboard fallback returns false and removes its textarea when execCommand reports failure', async () => {
    let removed = false
    const restoreNavigator = replaceGlobal('navigator', { clipboard: { writeText: async () => { throw new Error('unavailable') } } })
    const restoreDocument = replaceGlobal('document', {
        createElement: () => ({ value: '', style: {}, select: () => {}, remove: () => { removed = true } }),
        body: { appendChild: () => {} },
        execCommand: () => false,
    })
    try {
        assert.equal(await copyTextToClipboard('fallback payload'), false)
        assert.equal(removed, true)
    } finally {
        restoreDocument()
        restoreNavigator()
    }
})

test('shared copy wrapper maps fallback success and failure to caller feedback states', async () => {
    const states: Array<boolean | string | null> = []
    const setDidCopy: Dispatch<SetStateAction<boolean | string | null>> = state => states.push(typeof state === 'function' ? state(null) : state)
    const textarea = { value: '', style: {} as Record<string, string>, select: () => {}, remove: () => {} }
    const restoreNavigator = replaceGlobal('navigator', { clipboard: { writeText: async () => { throw new Error('unavailable') } } })
    const restoreDocument = replaceGlobal('document', {
        createElement: () => textarea,
        body: { appendChild: () => {} },
        execCommand: () => true,
    })
    try {
        copy({ type: 'link', text: 'https://example.test', setDidCopy })
        await new Promise(resolve => setTimeout(resolve, 0))
        assert.deepEqual(states, ['link'])

        states.length = 0
        const restoreFailedFallback = replaceGlobal('document', {
            createElement: () => textarea,
            body: { appendChild: () => {} },
            execCommand: () => false,
        })
        try {
            copy({ type: 'alias', text: 'https://alias.example.test', setDidCopy })
            await new Promise(resolve => setTimeout(resolve, 0))
            assert.deepEqual(states, ['error-alias'])
        } finally {
            restoreFailedFallback()
        }
    } finally {
        restoreDocument()
        restoreNavigator()
    }
})

test('shared copy wrapper maps unexpected fallback rejection to caller error feedback', async () => {
    const states: Array<boolean | string | null> = []
    const setDidCopy: Dispatch<SetStateAction<boolean | string | null>> = state => states.push(typeof state === 'function' ? state(null) : state)
    const restoreNavigator = replaceGlobal('navigator', { clipboard: { writeText: async () => { throw new Error('unavailable') } } })
    const restoreDocument = replaceGlobal('document', { createElement: () => { throw new Error('document unavailable') } })
    const originalLog = console.log
    console.log = () => {}
    try {
        copy({ type: 'alias', text: 'https://alias.example.test', setDidCopy })
        await new Promise(resolve => setTimeout(resolve, 0))
        assert.deepEqual(states, ['error-alias'])
    } finally {
        console.log = originalLog
        restoreDocument()
        restoreNavigator()
    }
})

test('failed fallback remains a caller-specific status and timing contract', async () => {
    const database = await readFile('src/app/dashboard/db/DatabaseRowPreview.tsx', 'utf8')
    const developerButton = await readFile('src/app/developers/copyCodeButton.tsx', 'utf8')
    const actorReferences = await readFile('src/app/ti/components/actor-references.tsx', 'utf8')
    const payloadButton = await readFile('src/app/ti/components/copy-payload-button.tsx', 'utf8')
    assert.match(database, /copyTextToClipboard\(value\) \? 'copied' : 'failed'/)
    assert.match(database, /setCopyStatus\(\{ key, result \}\)/)
    assert.match(database, /window\.setTimeout\(\(\) => setCopyStatus\(null\), 1600\)/)
    assert.match(database, /aria-live='polite'/)
    assert.match(developerButton, /if \(!await copyTextToClipboard\(value\)\) return/)
    assert.match(developerButton, /window\.setTimeout\(\(\) => setCopied\(false\), 1800\)/)
    assert.match(developerButton, /aria-label=\{`\$\{label\} code`\}/)
    assert.match(actorReferences, /copyTextToClipboard\(value\)/)
    assert.match(actorReferences, /setCopiedCitation\(current => current === copiedKey \? null : current\), 1000\)/)
    assert.match(payloadButton, /copyTextToClipboard\(text\)/)
    assert.match(payloadButton, /setState\(copied \? 'copied' : 'failed'\)/)
    assert.match(payloadButton, /resetLater\(copied \? 1800 : 2200\)/)
    assert.doesNotMatch(database, /execCommand\('copy'\)/)
    assert.doesNotMatch(developerButton, /execCommand\('copy'\)/)
    assert.doesNotMatch(actorReferences, /navigator\.clipboard\.writeText/)
    assert.doesNotMatch(payloadButton, /navigator\.clipboard\.writeText/)
})
