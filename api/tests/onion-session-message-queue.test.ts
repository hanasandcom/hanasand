import { expect, test } from 'bun:test'
import { OnionSessionMessageQueue, type OnionSessionMessage } from '../src/handlers/onionSession/messageQueue.ts'

type TestMessage = OnionSessionMessage & { value?: string }

function deferred() {
    let resolve!: () => void
    const promise = new Promise<void>(finish => { resolve = finish })
    return { promise, resolve }
}

async function waitFor(predicate: () => boolean) {
    const deadline = Date.now() + 1_000
    while (!predicate() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 1))
    expect(predicate()).toBe(true)
}

test('hover moves coalesce while drag moves remain ordered around other browser commands', async () => {
    const firstMessageStarted = deferred()
    const releaseFirstMessage = deferred()
    const handled: TestMessage[] = []
    const queue = new OnionSessionMessageQueue<TestMessage>(async message => {
        handled.push(message)
        if (message.value === 'block') {
            firstMessageStarted.resolve()
            await releaseFirstMessage.promise
        }
    }, error => { throw error })

    queue.enqueue({ type: 'command', value: 'block' })
    await firstMessageStarted.promise
    queue.enqueue({ type: 'pointer', event: 'pointermove', buttons: 0, value: 'hover-old' })
    queue.enqueue({ type: 'pointer', event: 'pointermove', buttons: 0, value: 'hover-latest' })
    queue.enqueue({ type: 'pointer', event: 'pointermove', buttons: 1, value: 'drag-first' })
    queue.enqueue({ type: 'pointer', event: 'pointermove', buttons: 1, value: 'drag-second' })
    queue.enqueue({ type: 'key', value: 'enter' })
    queue.enqueue({ type: 'pointer', event: 'pointermove', value: 'after-key' })
    releaseFirstMessage.resolve()
    await waitFor(() => handled.length === 6)

    expect(handled.map(message => message.value)).toEqual([
        'block', 'hover-latest', 'drag-first', 'drag-second', 'enter', 'after-key',
    ])
})

test('non-pointer backlog has a fixed bound and reports overload to the caller', async () => {
    const firstMessageStarted = deferred()
    const releaseFirstMessage = deferred()
    const handled: TestMessage[] = []
    const queue = new OnionSessionMessageQueue<TestMessage>(async message => {
        handled.push(message)
        if (message.value === 'block') {
            firstMessageStarted.resolve()
            await releaseFirstMessage.promise
        }
    }, error => { throw error }, 2)

    queue.enqueue({ type: 'command', value: 'block' })
    await firstMessageStarted.promise
    expect(queue.enqueue({ type: 'key', value: 'one' })).toBe(true)
    expect(queue.enqueue({ type: 'key', value: 'two' })).toBe(true)
    expect(queue.enqueue({ type: 'key', value: 'overflow' })).toBe(false)
    releaseFirstMessage.resolve()
    await waitFor(() => handled.length === 3)

    expect(handled.map(message => message.value)).toEqual(['block', 'one', 'two'])
})

test('pointer moves are discarded when the bounded queue is full', async () => {
    const firstMessageStarted = deferred()
    const releaseFirstMessage = deferred()
    const handled: TestMessage[] = []
    const queue = new OnionSessionMessageQueue<TestMessage>(async message => {
        handled.push(message)
        if (message.value === 'block') {
            firstMessageStarted.resolve()
            await releaseFirstMessage.promise
        }
    }, error => { throw error }, 1)

    queue.enqueue({ type: 'command', value: 'block' })
    await firstMessageStarted.promise
    queue.enqueue({ type: 'key', value: 'queued' })
    expect(queue.enqueue({ type: 'pointer', event: 'pointermove', value: 'dropped' })).toBe(true)
    releaseFirstMessage.resolve()
    await waitFor(() => handled.length === 2)

    expect(handled.map(message => message.value)).toEqual(['block', 'queued'])
})

test('queued command payloads are bounded by aggregate UTF-8 bytes', async () => {
    const firstMessageStarted = deferred()
    const releaseFirstMessage = deferred()
    const handled: TestMessage[] = []
    const queue = new OnionSessionMessageQueue<TestMessage>(async message => {
        handled.push(message)
        if (message.value === 'block') {
            firstMessageStarted.resolve()
            await releaseFirstMessage.promise
        }
    }, error => { throw error }, 10, 100)

    queue.enqueue({ type: 'command', value: 'block' })
    await firstMessageStarted.promise
    const first = { type: 'key', value: 'é'.repeat(22) }
    const second = { type: 'key', value: 'é'.repeat(22) }
    expect(Buffer.byteLength(JSON.stringify(first), 'utf8')).toBeLessThan(100)
    expect(queue.enqueue(first)).toBe(true)
    expect(queue.enqueue(second)).toBe(false)
    releaseFirstMessage.resolve()
    await waitFor(() => handled.length === 2)
    expect(handled.map(message => message.value)).toEqual(['block', first.value])
})

test('one oversized queued command is rejected', async () => {
    const firstMessageStarted = deferred()
    const releaseFirstMessage = deferred()
    const queue = new OnionSessionMessageQueue<TestMessage>(async message => {
        if (message.value === 'block') {
            firstMessageStarted.resolve()
            await releaseFirstMessage.promise
        }
    }, error => { throw error }, 10, 100)

    queue.enqueue({ type: 'command', value: 'block' })
    await firstMessageStarted.promise
    expect(queue.enqueue({ type: 'clipboard', value: 'x'.repeat(100) })).toBe(false)
    releaseFirstMessage.resolve()
})
