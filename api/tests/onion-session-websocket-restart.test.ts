import { expect, test } from 'bun:test'
import {
    configureTestEnvironment,
    ControlledSocket,
    endSession,
    FakeDownload,
    FakePage,
    startRun,
    waitFor,
} from './onion-session-websocket-harness.ts'

test('restarting an onion session resets per-run download limits and summaries', async () => {
    const browser = configureTestEnvironment()
    const { handleOnionSessionSocket } = await import('../src/handlers/onionSession/ws.ts')
    const socket = new ControlledSocket()
    handleOnionSessionSocket(socket as never, 'restart-download-reset', 'regular')

    try {
        await startRun(socket, 'https://8.8.8.8/first')
        const firstPage = browser.contexts[0].pages[0]
        for (let index = 0; index < 10; index++) {
            const download = new FakeDownload(`https://files.example/${index}`, async () => null)
            firstPage.emit('download', download)
            await waitFor(() => download.deleteCount === 1 ? true : undefined, `first-run download ${index + 1}`)
        }

        await startRun(socket, 'https://8.8.8.8/second')
        const secondPage = browser.contexts[1].pages[0]
        const nextDownload = new FakeDownload('https://files.example/next', async () => null)
        secondPage.emit('download', nextDownload)
        await waitFor(() => nextDownload.deleteCount === 1 ? true : undefined, 'second-run download')

        expect(socket.messages.some(message => message.state === 'download_limit')).toBe(false)
        const latestSummary = socket.messages.filter(message => message.type === 'downloads').at(-1)?.networkSummary
        expect(latestSummary.downloads).toHaveLength(1)
        expect(latestSummary.downloads[0]).toMatchObject({ id: 'file-1', url: 'https://files.example/next' })
    } finally {
        await endSession(socket)
    }
})

test('restarting and ending an onion session close the retired and current pages', async () => {
    const browser = configureTestEnvironment()
    const { handleOnionSessionSocket } = await import('../src/handlers/onionSession/ws.ts')
    const socket = new ControlledSocket()
    handleOnionSessionSocket(socket as never, 'restart-page-cleanup', 'regular')
    let currentPage: FakePage | undefined

    try {
        await startRun(socket, 'https://8.8.8.8/first')
        const retiredPage = browser.contexts[0].pages[0]
        await startRun(socket, 'https://8.8.8.8/second')
        currentPage = browser.contexts[1].pages[0]
        expect(retiredPage.isClosed()).toBe(true)
    } finally {
        await endSession(socket)
    }

    expect(currentPage?.isClosed()).toBe(true)
})

test('a prior run download cannot release a later run transfer slot', async () => {
    const browser = configureTestEnvironment()
    const { handleOnionSessionSocket } = await import('../src/handlers/onionSession/ws.ts')
    const socket = new ControlledSocket()
    handleOnionSessionSocket(socket as never, 'restart-download-race', 'regular')
    let resolveOldPath!: (path: string | null) => void
    const oldPath = new Promise<string | null>(resolve => { resolveOldPath = resolve })
    const resolveActivePaths: Array<(path: string | null) => void> = []
    const activeDownloads: FakeDownload[] = []

    try {
        await startRun(socket, 'https://8.8.8.8/first')
        const firstPage = browser.contexts[0].pages[0]
        const oldDownload = new FakeDownload('https://files.example/old', () => oldPath)
        firstPage.emit('download', oldDownload)
        await startRun(socket, 'https://8.8.8.8/second')
        const secondPage = browser.contexts[1].pages[0]
        activeDownloads.push(...[0, 1].map(index => new FakeDownload(
            `https://files.example/active-${index}`,
            () => new Promise<string | null>(resolve => resolveActivePaths.push(resolve)),
        )))
        activeDownloads.forEach(download => secondPage.emit('download', download))
        await waitFor(() => activeDownloads.every(download => download.pathCount === 1) ? true : undefined, 'active second-run downloads')
        resolveOldPath(null)
        await waitFor(() => oldDownload.deleteCount === 1 ? true : undefined, 'retired download cleanup')

        const rejectedDownload = new FakeDownload('https://files.example/rejected', async () => null)
        secondPage.emit('download', rejectedDownload)
        await waitFor(() => socket.messages.some(message => message.state === 'download_limit') ? true : undefined, 'second-run transfer limit')
        expect(rejectedDownload.cancelCount).toBe(1)
        expect(socket.messages.filter(message => message.type === 'downloads').at(-1)?.networkSummary.downloads.map((file: any) => file.url))
            .toEqual(['https://files.example/active-0', 'https://files.example/active-1'])
    } finally {
        resolveOldPath(null)
        for (const resolve of resolveActivePaths) resolve(null)
        await Promise.all([...activeDownloads].map(download => waitFor(() => download.deleteCount === 1 ? true : undefined, 'active download cleanup')))
        await endSession(socket)
    }
})

test('restarting clears editable select-all state before a later copy', async () => {
    const browser = configureTestEnvironment()
    const { handleOnionSessionSocket } = await import('../src/handlers/onionSession/ws.ts')
    const socket = new ControlledSocket()
    handleOnionSessionSocket(socket as never, 'restart-editable-select-all', 'regular')

    try {
        await startRun(socket, 'https://8.8.8.8/first')
        const firstPage = browser.contexts[0].pages[0]
        socket.receive({ type: 'key', key: 'a', ctrlKey: true })
        await waitFor(() => firstPage.editableSelections === 1 ? true : undefined, 'first-run editable select-all')
        await startRun(socket, 'https://8.8.8.8/second')
        const secondPage = browser.contexts[1].pages[0]
        socket.receive({ type: 'key', key: 'c', ctrlKey: true })
        await waitFor(() => secondPage.keyboard.pressed.includes('Control+C') ? true : undefined, 'second-run copy')
        socket.receive({ type: 'clipboard', direction: 'remote-to-browser' })
        const clipboard = await waitFor(() => socket.messages.find(message =>
            message.type === 'clipboard' && message.direction === 'remote-to-browser'), 'second-run clipboard response')
        expect(clipboard.text).toBe('')
    } finally {
        await endSession(socket)
    }
})

test('a late response from a prior run cannot enter the next run summary', async () => {
    const browser = configureTestEnvironment()
    const { handleOnionSessionSocket } = await import('../src/handlers/onionSession/ws.ts')
    const socket = new ControlledSocket()
    handleOnionSessionSocket(socket as never, 'restart-response-race', 'regular')
    let resolveServerAddress!: (address: null) => void
    const serverAddress = new Promise<null>(resolve => { resolveServerAddress = resolve })

    try {
        await startRun(socket, 'https://8.8.8.8/first')
        const firstPage = browser.contexts[0].pages[0]
        const oldRequest = {
            isNavigationRequest: () => false,
            frame: () => ({ url: () => 'https://8.8.8.8/first' }),
            resourceType: () => 'image',
            method: () => 'GET',
            timing: () => ({ startTime: 0, responseEnd: 1 }),
        }
        firstPage.emit('response', {
            serverAddr: () => serverAddress,
            securityDetails: async () => null,
            request: () => oldRequest,
            status: () => 200,
            url: () => 'https://old-run.example/image.png',
            headers: () => ({ 'content-type': 'image/png' }),
        })
        await startRun(socket, 'https://8.8.8.8/second')
        resolveServerAddress(null)
        await new Promise(resolve => setImmediate(resolve))

        const secondPage = browser.contexts[1].pages[0]
        const download = new FakeDownload('https://files.example/current', async () => null)
        secondPage.emit('download', download)
        await waitFor(() => download.deleteCount === 1 ? true : undefined, 'second-run network summary')
        const summary = socket.messages.filter(message => message.type === 'downloads').at(-1)?.networkSummary
        expect(summary.responseCount).toBe(0)
        expect(summary.domains).not.toContain('old-run.example')
    } finally {
        resolveServerAddress(null)
        await endSession(socket)
    }
})
