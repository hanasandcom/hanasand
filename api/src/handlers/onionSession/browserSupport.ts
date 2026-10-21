import { chromium, type Page } from 'playwright'
import type { SessionState } from './sessionState.ts'
import { providerChromiumLaunchOptions } from './browserRuntime.ts'
import { installSandboxRequestGuard } from './browserPageEvents.ts'
import type { SandboxNetworkEvent } from './networkTelemetry.ts'

type BrowserTabServiceDependencies = {
    state: SessionState
    send: (payload: Record<string, unknown>) => void
    isCurrentRun: (generation: number) => boolean
    sendFrame: (force: boolean, reason?: string, generation?: number) => Promise<void>
}

export function createBrowserSupportService({ state, send, isCurrentRun, sendFrame }: BrowserTabServiceDependencies) {
    async function newProviderPage(generation: number) {
        if (!state.providerBrowserPromise) {
            // Keep provider pages in their own headed display, off the live stream.
            const launch = chromium.launch(providerChromiumLaunchOptions())
                .then(browser => {
                    if (!isCurrentRun(generation)) {
                        void browser.close()
                        throw new Error('Run ended before provider browser started.')
                    }
                    state.providerBrowser = browser
                    browser.on('disconnected', () => {
                        if (state.providerBrowser === browser) {
                            state.providerBrowser = null
                            state.providerBrowserPromise = null
                        }
                    })
                    return browser
                })
                .catch(error => {
                    if (state.providerBrowserPromise === launch) state.providerBrowserPromise = null
                    throw error
                })
            state.providerBrowserPromise = launch
        }
        const browser = await state.providerBrowserPromise
        if (!isCurrentRun(generation)) throw new Error('Run ended before provider page opened.')
        const context = await browser.newContext({ serviceWorkers: 'block' })
        await installSandboxRequestGuard({
            context,
            generation,
            network: 'regular',
            isCurrentRun,
            trackNetwork: (event: SandboxNetworkEvent) => state.networkTelemetry.record(event),
            send: payload => send({ ...payload, source: 'provider' }),
        })
        const page = await context.newPage()
        return { page, close: () => context.close() }
    }

    function watchConsole(targetPage: Page, generation: number, tabId = 'browser', name = 'Browser') {
        const source = tabId === 'browser' ? 'target' : 'provider'
        targetPage.on('console', entry => {
            if (!isCurrentRun(generation)) return
            const location = entry.location()
            send({ type: 'console', source, tabId, name, level: entry.type(), text: entry.text(),
                url: location.url || targetPage.url(), line: location.lineNumber === undefined ? undefined : location.lineNumber + 1,
                capturedAt: new Date().toISOString() })
        })
        targetPage.on('pageerror', error => {
            if (!isCurrentRun(generation)) return
            send({ type: 'pageerror', source, tabId, name, level: 'error', message: error.message,
                url: targetPage.url(), capturedAt: new Date().toISOString() })
        })
    }

    function scheduleInteractionFrame(generation = state.runGeneration) {
        if (state.interactionFrameTimer || state.closed) return
        state.interactionFrameTimer = setTimeout(() => {
            state.interactionFrameTimer = null
            void sendFrame(false, 'interaction', generation)
        }, 40)
    }

    return { newProviderPage, watchConsole, scheduleInteractionFrame }
}
