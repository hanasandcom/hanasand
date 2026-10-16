

export async function installBrowserTestSetup(page) {
    await page.addInitScript(() => {
        Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => { throw new Error('Clipboard unavailable') } } })
        window.browserMessages = []
        window.WebSocket = class {
            static OPEN = 1
            readyState = 1
            constructor() { window.testSocket = this; setTimeout(() => this.onopen?.(), 0) }
            send(message) { window.browserMessages.push(JSON.parse(message)) }
            close() { this.readyState = 3; this.onclose?.() }
        }
        window.deliver = payload => window.testSocket.onmessage({ data: JSON.stringify(payload) })
    })
}
