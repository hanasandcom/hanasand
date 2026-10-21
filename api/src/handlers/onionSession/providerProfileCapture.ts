import type { SandboxDeobfuscationTask, WebCrackLoadResult } from './providerTypes.ts'
import { watchWebCrackOutput, readWebCrackOutput } from './webcrack.ts'
import { providerCaptureMessage, type ProviderCaptureDetails, type ProviderProfileCaptureDependencies } from './providerCapture.ts'
import { isWebCrackTool, providerStartUrl, interactWithProvider, officialProviderKind } from './providerNavigation.ts'
import { collectProviderResponses } from './providerUrlResponses.ts'
import { waitForProviderData, providerTimeoutMs, providerScreenshotTimeoutMs, waitForProviderVisual, hasParsedProviderData, providerAccessIssue, fetchProviderCommunityComments, enrichProviderEvidence } from './providerText.ts'
import { analyzeToolEvidence, providerPendingEvidence, safeToolId } from './providerAnalysis.ts'
import { withTimeout } from './asyncOperations.ts'
import { dismissCookieOverlays } from './dismissCookieOverlays.ts'
import { loadWebCrackSample, collectFastRenderedText, collectPageEvidence } from './pageEvidence.ts'

export function createProviderProfileCaptureService({ sessionId, isCurrentRun, send, webCrackTasks, newProviderPage, watchConsole, maybeExtendSuspiciousRun, persistProviderRunResult }: ProviderProfileCaptureDependencies) {
    async function captureProfileTools(
        tools: Array<{ id?: string; name?: string; url?: string }>,
        target: string,
        deobfuscationTasks: SandboxDeobfuscationTask[] = [],
        generation: number,
        runId: string | null,
    ) {
        const plannedTools = tools.slice(0, 6).filter(tool => tool.url)
        if (process.env.BROWSER_SANDBOX_PROVIDER_TABS === '0') return
        await Promise.all(plannedTools.map(async (tool) => {
            const startedAt = new Date().toISOString()
            const toolUrl = tool.url!.replaceAll('{url}', encodeURIComponent(target)).replaceAll('{rawUrl}', target)
            const webcrackTool = isWebCrackTool(tool, toolUrl)
            const toolId = tool.id || safeToolId(tool.name || toolUrl)
            const sendToolCapture = (
                url: string,
                details: ProviderCaptureDetails,
                id = tool.id || safeToolId(tool.name || toolUrl),
            ) => {
                if (!isCurrentRun(generation)) return
                send(providerCaptureMessage(sessionId, {
                    id,
                    name: tool.name || toolUrl,
                    url,
                    capturedAt: startedAt,
                    target,
                }, details))
            }
            const webcrackTasks = webcrackTool ? await webCrackTasks(deobfuscationTasks, generation) : []
            if (!isCurrentRun(generation)) return
            if (webcrackTool && !webcrackTasks.some(task => task.sample || task.decodedPreview)) {
                const evidence = providerPendingEvidence(toolUrl, tool.name || toolUrl, target)
                const webcrackLoad = { loaded: false, reason: 'no obfuscated code found on target page' }
                sendToolCapture(toolUrl, { evidence, webcrackLoad, toolAnalysis: analyzeToolEvidence(tool.name || toolUrl, evidence, webcrackLoad) }, toolId)
                return
            }
            const providerSession = await newProviderPage(generation).catch(() => null)
            const toolPage = providerSession?.page
            if (!toolPage || !providerSession || !isCurrentRun(generation)) {
                await providerSession?.close().catch(() => undefined)
                return
            }
            if (webcrackTool) await watchWebCrackOutput(toolPage)
            if (!isCurrentRun(generation)) {
                await providerSession.close().catch(() => undefined)
                return
            }
            watchConsole(toolPage, generation, toolId, tool.name || toolId)
            const providerBodies = collectProviderResponses(toolPage, tool.name || toolUrl, target)
            try {
                toolPage.setDefaultTimeout(providerTimeoutMs(tool))
                send({
                    type: 'status',
                    state: 'profile_tool_started',
                    sessionId,
                    message: `${tool.name || toolUrl} provider capture started.`,
                })
                const preparedUrl = providerStartUrl(tool, toolUrl, target)
                const pendingEvidence = providerPendingEvidence(preparedUrl, tool.name || toolUrl, target)
                sendToolCapture(preparedUrl, {
                    evidence: pendingEvidence,
                    toolAnalysis: analyzeToolEvidence(tool.name || toolUrl, pendingEvidence),
                    error: 'provider_navigation_pending',
                })
                let navigationError = await withTimeout(
                    toolPage.goto(preparedUrl, { waitUntil: 'commit', timeout: providerTimeoutMs(tool) })
                        .then(() => '')
                        .catch(error => error instanceof Error ? error.message : String(error)),
                    providerTimeoutMs(tool),
                    `provider navigation still pending after ${Math.round(providerTimeoutMs(tool) / 1000)}s`,
                )
                await toolPage.waitForLoadState('domcontentloaded', { timeout: providerTimeoutMs(tool) }).catch(() => undefined)
                await withTimeout(dismissCookieOverlays(toolPage), 1200, undefined).catch(() => undefined)
                const actionError = await interactWithProvider(toolPage, tool, target)
                navigationError ||= actionError
                const openedScreenshotTimeout = providerScreenshotTimeoutMs(tool, 800)
                const openedImage = webcrackTool ? null : await withTimeout(toolPage.screenshot({ type: 'jpeg', quality: 56, animations: 'disabled', timeout: openedScreenshotTimeout }), openedScreenshotTimeout, null)
                const openedEvidence = providerPendingEvidence(toolPage.url() || preparedUrl, tool.name || toolUrl, target)
                sendToolCapture(toolPage.url() || preparedUrl, {
                    title: await toolPage.title().catch(() => ''),
                    image: openedImage ? openedImage.toString('base64') : null,
                    evidence: openedEvidence,
                    toolAnalysis: analyzeToolEvidence(tool.name || toolUrl, openedEvidence),
                    error: navigationError || 'Provider tab opened; verdict parsing is still running.',
                })
                const providerText = officialProviderKind(preparedUrl)
                    ? await waitForProviderData(tool, toolPage, providerBodies.text, target)
                    : [providerBodies.text(), await withTimeout(collectFastRenderedText(toolPage), 1000, '')].filter(Boolean).join('\n')
                navigationError ||= providerAccessIssue(tool, providerText, toolPage.url())
                if (providerText && hasParsedProviderData(tool, providerText)) {
                    navigationError = ''
                    await waitForProviderVisual(tool, toolPage)
                    const fetchedComments = await fetchProviderCommunityComments(toolPage, tool, target)
                    const parsedEvidence = enrichProviderEvidence({
                        ...providerPendingEvidence(toolPage.url() || preparedUrl, tool.name || toolUrl, target),
                        textExcerpt: '',
                        reasons: [],
                    }, providerText, tool.name || toolUrl, [...providerBodies.comments(), ...fetchedComments])
                    const parsedAnalysis = analyzeToolEvidence(tool.name || toolUrl, parsedEvidence)
                    maybeExtendSuspiciousRun(parsedEvidence, parsedAnalysis, generation)
                    const parsedScreenshotTimeout = providerScreenshotTimeoutMs(tool, 1500)
                    const parsedImage = await withTimeout(toolPage.screenshot({ type: 'jpeg', quality: 64, animations: 'disabled', timeout: parsedScreenshotTimeout }), parsedScreenshotTimeout, openedImage)
                    persistProviderRunResult(parsedAnalysis, '', runId, generation)
                    sendToolCapture(toolPage.url() || preparedUrl, {
                        title: await toolPage.title().catch(() => ''),
                        image: parsedImage ? parsedImage.toString('base64') : null,
                        evidence: parsedEvidence,
                        toolAnalysis: parsedAnalysis,
                    })
                    if (officialProviderKind(preparedUrl)) return
                }
                // An unverified provider page (including search results) is not a verdict.
                if (officialProviderKind(preparedUrl)) {
                    const evidence = providerPendingEvidence(toolPage.url() || preparedUrl, tool.name || toolUrl, target)
                    sendToolCapture(toolPage.url() || preparedUrl, {
                        image: openedImage?.toString('base64') || null,
                        evidence,
                        toolAnalysis: analyzeToolEvidence(tool.name || toolUrl, evidence),
                        error: navigationError || providerText || 'No verified report returned for the submitted URL within the provider time limit.',
                    }, toolId)
                    return
                }
                let webcrackLoad: WebCrackLoadResult | undefined
                if (webcrackTool) {
                    webcrackLoad = await withTimeout(loadWebCrackSample(toolPage, webcrackTasks), 5000, { loaded: false, reason: 'WebCrack did not accept a sample within the provider budget.' })
                }
                await toolPage.waitForTimeout(webcrackLoad?.loaded ? 150 : 1200).catch(() => undefined)
                if (webcrackTool) {
                    const evidence = enrichProviderEvidence(await withTimeout(collectPageEvidence(toolPage), 400, providerPendingEvidence(toolPage.url() || toolUrl, tool.name || toolUrl, target)), providerBodies.text(), tool.name || toolUrl, providerBodies.comments())
                    const toolAnalysis = analyzeToolEvidence(tool.name || toolUrl, evidence, webcrackLoad)
                    maybeExtendSuspiciousRun(evidence, toolAnalysis, generation)
                    const output = webcrackLoad?.loaded ? await readWebCrackOutput(toolPage) : undefined
                    sendToolCapture(toolPage.url(), {
                        title: await toolPage.title().catch(() => ''),
                        deobfuscatedCode: output?.code,
                        evidence,
                        toolAnalysis,
                        webcrackLoad,
                        error: output?.error || (webcrackLoad?.loaded ? navigationError : webcrackLoad?.reason) || undefined,
                    })
                    return
                }
                const initialEvidence = enrichProviderEvidence(await withTimeout(collectPageEvidence(toolPage), 2500, providerPendingEvidence(toolPage.url() || toolUrl, tool.name || toolUrl, target)), providerBodies.text(), tool.name || toolUrl, providerBodies.comments())
                const initialImage = await withTimeout(toolPage.screenshot({ type: 'jpeg', quality: 64, animations: 'disabled', timeout: 2500 }), 2500, null)
                const initialAnalysis = analyzeToolEvidence(tool.name || toolUrl, initialEvidence)
                maybeExtendSuspiciousRun(initialEvidence, initialAnalysis, generation)
                const image = initialImage
                const evidence = initialEvidence
                const toolAnalysis = navigationError
                    ? {
                        ...initialAnalysis,
                        extractedSignals: [
                            ...((initialAnalysis.extractedSignals || []) as string[]),
                            `Provider navigation incomplete: ${navigationError}`,
                        ],
                    }
                    : initialAnalysis
                sendToolCapture(toolPage.url(), {
                    title: await toolPage.title().catch(() => ''),
                    image: image ? image.toString('base64') : null,
                    evidence,
                    toolAnalysis,
                    webcrackLoad,
                    error: navigationError || undefined,
                })
                persistProviderRunResult(toolAnalysis, navigationError, runId, generation)
            } catch (error) {
                sendToolCapture(toolUrl, { error: error instanceof Error ? error.message : String(error) })
            } finally {
                await providerSession.close().catch(() => undefined)
            }
        }))
    }
    return captureProfileTools
}
