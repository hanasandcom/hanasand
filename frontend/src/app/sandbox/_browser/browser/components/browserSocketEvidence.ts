import { finiteNumber, evidenceValue, toolAnalysisValue, networkSummaryValue, webcrackLoadValue, frameQualityValue, stringValue, safeToolKey } from '../browserValues'
import { addCapture, captureLabel, providerRunResult } from '../browserRunData'
import { hasParsedProviderResult } from '../browserProviderData'
import { isBrowserErrorUrl } from '../browserSetup'
import type { BrowserSocketMessageContext } from './browserSocketMessageTypes'
import type { Capture } from '../types'
import { persistHistory } from '../historyData'
import { isUsefulFrameImage } from '../browserAnalystSummary'

export function handleBrowserEvidenceMessage(context: BrowserSocketMessageContext) {
    const { payload, runState, id, url, receivedEvidenceRef, pushEvent, setCaptures, setActiveImage, setActiveUrl, setRemoteTabUrls, setActiveFrame, setSessionState, setRunBlocker, setHistory } = context

    if (payload.type === 'downloads') {
        const networkSummary = networkSummaryValue(payload.networkSummary)
        if (!networkSummary) return
        if (networkSummary.downloads?.length) receivedEvidenceRef.current = true
        setCaptures(current => [{
            id: 'file-evidence',
            kind: 'page', label: 'File evidence', url: url,
            capturedAt: new Date().toISOString(), reason: 'download', networkSummary,
        }, ...current.filter(capture => capture.id !== 'file-evidence')].slice(0, 24) as Capture[])
        return
    }
    if (payload.type === 'live_frame' && typeof payload.image === 'string') {
        const urlValue = String(payload.url || url)
        if (urlValue === 'about:blank' || isBrowserErrorUrl(urlValue)) return
        const image = `data:image/jpeg;base64,${payload.image}`
        if (!isUsefulFrameImage(image)) return
        receivedEvidenceRef.current = true
        setActiveImage(image)
        runState.receivedPageFrame = true
        runState.lastPageUrl = urlValue
        setActiveUrl(urlValue)
        setRemoteTabUrls(current => ({ ...current, browser: urlValue }))
        setActiveFrame({ width: finiteNumber(payload.width) || 1280, height: finiteNumber(payload.height) || 720 })
        setSessionState(current => current === 'connecting' || current === 'queued' || current === 'unreachable' ? 'live' : current)
        setRunBlocker('')
        return
    }
    if (payload.type === 'frame' && typeof payload.image === 'string') {
        const image = `data:image/jpeg;base64,${payload.image}`
        const evidence = evidenceValue(payload.evidence)
        if (isUsefulFrameImage(image)) {
            receivedEvidenceRef.current = true
            setActiveImage(image)
        }
        const urlValue = String(payload.url || url)
        runState.receivedPageFrame = !isBrowserErrorUrl(urlValue)
        if (!isBrowserErrorUrl(urlValue)) runState.lastPageUrl = urlValue
        const frameWidth = finiteNumber(payload.width) || 1280
        const frameHeight = finiteNumber(payload.height) || 720
        setActiveUrl(urlValue)
        setRemoteTabUrls(current => ({ ...current, browser: urlValue }))
        setActiveFrame({ width: frameWidth, height: frameHeight })
        if (isBrowserErrorUrl(urlValue)) {
            setSessionState('unreachable')
            setRunBlocker('Target page did not load; the isolated browser showed an error page.')
        } else {
            runState.receivedPageFrame = true
            setSessionState(current => current === 'connecting' || current === 'queued' || current === 'unreachable' ? 'live' : current)
            setRunBlocker('')
        }
        const reason = stringValue(payload.reason)
        setCaptures(current => addCapture(current, {
            id: `page-${payload.capturedAt || Date.now()}-${current.length}`,
            kind: 'page',
            label: captureLabel(reason),
            url: urlValue,
            title: stringValue(payload.title),
            capturedAt: stringValue(payload.capturedAt) || new Date().toISOString(),
            reason,
            image,
            frameWidth,
            frameHeight,
            frameQuality: frameQualityValue(payload.frameQuality),
            evidence,
            networkSummary: networkSummaryValue(payload.networkSummary),
        }))
        return
    }
    if (payload.type === 'tool_capture') {
        const image = typeof payload.image === 'string' ? `data:image/jpeg;base64,${payload.image}` : null
        const toolAnalysis = toolAnalysisValue(payload.toolAnalysis)
        if (hasParsedProviderResult(toolAnalysis)) receivedEvidenceRef.current = true
        const providerResult = providerRunResult(toolAnalysis, stringValue(payload.error))
        setCaptures(current => addCapture(current, {
            id: `tool-${payload.id || current.length}-${payload.capturedAt || Date.now()}`,
            kind: 'tool',
            label: stringValue(payload.name) || 'Profile tool',
            url: stringValue(payload.url) || '',
            target: stringValue(payload.target),
            title: stringValue(payload.title),
            capturedAt: stringValue(payload.capturedAt) || new Date().toISOString(),
            image,
            error: stringValue(payload.error),
            evidence: evidenceValue(payload.evidence),
            toolAnalysis,
            webcrackLoad: webcrackLoadValue(payload.webcrackLoad),
            deobfuscatedCode: stringValue(payload.deobfuscatedCode),
        }))
        if (providerResult) {
            setHistory(current => persistHistory(current.map(run => run.id === id
                ? { ...run, providerResults: { ...(run.providerResults || {}), [toolAnalysis?.toolKind || safeToolKey(stringValue(payload.id) || stringValue(payload.name))]: providerResult } }
                : run)))
        }
        pushEvent(`${stringValue(payload.name) || 'Profile tool'} captured.`)
        return
    }
}
