import { strict as assert } from 'node:assert'
import test from 'node:test'
import { shareSavedFinding } from '../src/app/browser/shareSavedFinding'

const run = { id: 'run / one', target: 'example.com' }
const expectedUrl = 'https://hanasand.test/sandbox/report?run=run+%2F+one'

function setBrowserMocks(navigatorValue: object, prompt: (...args: string[]) => string | null = () => null) {
    const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
    const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: navigatorValue })
    Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: { location: { origin: 'https://hanasand.test' }, prompt },
    })
    return () => {
        if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator)
        else Reflect.deleteProperty(globalThis, 'navigator')
        if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow)
        else Reflect.deleteProperty(globalThis, 'window')
    }
}

test('sharing prefers the native share sheet with the report link and target title', async () => {
    let shared: unknown
    let clipboardUsed = false
    const restore = setBrowserMocks({
        share: async (value: unknown) => { shared = value },
        clipboard: { writeText: async () => { clipboardUsed = true } },
    })
    try {
        assert.equal(await shareSavedFinding(run), 'Finding shared.')
        assert.deepEqual(shared, { title: 'Sandbox finding: example.com', url: expectedUrl })
        assert.equal(clipboardUsed, false)
    } finally {
        restore()
    }
})

test('sharing copies the report link when the native share sheet is unavailable', async () => {
    let copied = ''
    const restore = setBrowserMocks({ clipboard: { writeText: async (value: string) => { copied = value } } })
    try {
        assert.equal(await shareSavedFinding(run), 'Share link copied.')
        assert.equal(copied, expectedUrl)
    } finally {
        restore()
    }
})

test('sharing offers the report link through prompt when browser sharing is unavailable', async () => {
    let prompted: string[] = []
    const restore = setBrowserMocks({}, (...args) => { prompted = args; return null })
    try {
        assert.equal(await shareSavedFinding(run), 'Share link ready.')
        assert.deepEqual(prompted, ['Copy this finding link', expectedUrl])
    } finally {
        restore()
    }
})
