import type { BrowserContext, Page } from 'playwright'
import type { SessionState } from './sessionState.ts'

type BrowserTabServiceDependencies = {
    state: SessionState
    send: (payload: Record<string, unknown>) => void
    trace: (event: string, detail?: Record<string, unknown>) => void
    isCurrentRun: (generation: number) => boolean
    sendFrame: (force: boolean, reason?: string, generation?: number) => Promise<void>
}

export function createBrowserTabService({ state, send, trace, isCurrentRun, sendFrame }: BrowserTabServiceDependencies) {
    function cleanRemoteTabId(value: unknown) {
        const id = typeof value === 'string' ? value.trim() : ''
        return /^[a-z0-9_-]{1,80}$/i.test(id) ? id : 'browser'
    }

    function remoteTabIdForPage(candidate: Page) {
        if (candidate === state.page) return 'browser'
        for (const [tabId, toolPage] of state.toolPages) {
            if (candidate === toolPage) return tabId
        }
        return ''
    }

    async function syncVisibleRemoteTab(selectedPage: Page, generation = state.runGeneration) {
        if (!isCurrentRun(generation) || state.openingBackgroundTabs) return
        if (!await selectedPage.evaluate(() => document.visibilityState === 'visible').catch(() => false)) return
        if (!isCurrentRun(generation) || state.openingBackgroundTabs) return
        const tabId = remoteTabIdForPage(selectedPage)
        if (!tabId || tabId === state.activeRemoteTabId) return
        state.activeRemoteTabId = tabId
        trace('native_tab_selected', { tabId, url: selectedPage.url() })
        send({ type: 'status', state: 'tab_selected', tabId, url: selectedPage.url(), message: 'Remote browser tab selected.' })
    }

    async function newBackgroundPage(context: BrowserContext, generation: number) {
        state.openingBackgroundTabs++
        try {
            return await context.newPage()
        } finally {
            // Creating a Chromium tab activates it. Restore the user's selected
            // tab before allowing native visibility events to select a tab.
            if (isCurrentRun(generation)) {
                await focusRemoteTab(false, generation)
                if (isCurrentRun(generation)) state.openingBackgroundTabs--
            }
        }
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
        // Coalesce pointer/key bursts without delaying the input queue behind
        // screenshots or full evidence collection.
        state.interactionFrameTimer = setTimeout(() => {
            state.interactionFrameTimer = null
            void sendFrame(false, 'interaction', generation)
        }, 40)
    }

    async function focusRemoteTab(report = false, generation = state.runGeneration) {
        if (!isCurrentRun(generation)) return
        const selectedPage = state.activeRemoteTabId === 'browser' ? state.page : state.toolPages.get(state.activeRemoteTabId)
        if (!selectedPage || selectedPage.isClosed()) {
            if (report) send({ type: 'status', state: 'tab_waiting', tabId: state.activeRemoteTabId, message: 'Remote tab is still opening.' })
            return
        }
        const focusError = await selectedPage.bringToFront()
            .then(() => selectedPage.evaluate(() => window.focus()))
            .then(() => '')
            .catch(error => error instanceof Error ? error.message : String(error))
        if (!isCurrentRun(generation)) return
        if (focusError) {
            send({ type: 'status', state: 'tab_select_failed', tabId: state.activeRemoteTabId, url: selectedPage.url(), message: `Remote tab could not be selected: ${focusError}` })
            return
        }
        if (report) send({ type: 'status', state: 'tab_selected', tabId: state.activeRemoteTabId, url: selectedPage.url(), message: 'Remote browser tab selected.' })
    }

    return { cleanRemoteTabId, remoteTabIdForPage, syncVisibleRemoteTab, newBackgroundPage, watchConsole, scheduleInteractionFrame, focusRemoteTab }
}
