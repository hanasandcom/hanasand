'use client'

import Link from 'next/link'
import { ArrowLeft, ArrowUp, ChevronDown, Download, LoaderCircle, PackageCheck, Plus, Share2, ShieldCheck, Square } from 'lucide-react'
import BrowserRunMetrics from '../BrowserRunMetrics'
import BrowserDebug from '../BrowserDebug'
import { BrowserLoading, SandboxTabStrip, ProviderStatusPanel } from './BrowserStatus'
import { StatusPill, ProviderViewportEvidence, ProviderReportDetails, DownloadsPanel } from './EvidencePrimitives'
import { EvidenceWorkspace } from './EvidenceWorkspace'
import { AnalystSummary } from './AnalystSummary'
import { CaptureTimeline } from './CaptureTimeline'
import { sessionStateLabel, formatRunDuration, socketStateLabel } from '../browserRunData'
import { providerDetail } from '../browserProviderData'
import { queueCopy } from '../browserValues'
import { scrollRouteFrameToTop } from '../browserSetup'
import type { BrowserWorkspaceProps } from './BrowserWorkspaceTypes'

export function BrowserWorkspace(props: BrowserWorkspaceProps) {
    const { loadingBrowser, startupStage, runStartedAt, clockNow, normalizedTarget, capacity, stopRun, activeSandboxTab, sessionState, socketState, selectedProfile, toolCaptures, remoteTabUrls, activeUrl, siteNetwork, selectSandboxTab, runTiming, runRemainingSeconds, paidBrowserPlan, extendRun, exportReport, captures, currentRunId, shareStatus, saveReport, resetRun, shareUrl, setShareStatus, shareError, setShareError, runMetrics, reportOpen, setReportOpen, summary, checksWithoutVerdict, reviewChecksOpen, setReviewChecksOpen, startRun, stoppedRunRef, stoppedEarlyRef, runIsActive, runBlocker, viewportRef, streamUrl, viewportFrame, fallbackInteractive, keyBrowserFrame, streamRef, streamAttempt, streamHasFrame, streamNeedsGesture, activeTool, activeToolCapture, activeViewportImage, imageRef, waitingSeconds, waitingForFrame, consoleEvents } = props
    return (
        <main className='relative min-h-app-viewport overflow-x-hidden bg-ui-canvas text-ui-text'>
            {loadingBrowser ? <BrowserLoading stage={startupStage} elapsed={runStartedAt ? Math.max(0, Math.floor((clockNow - runStartedAt) / 1000)) : 0} target={normalizedTarget} queuePosition={capacity?.queuePosition} onCancel={stopRun} /> : null}
            {/* Keep the stream mounted and sized so it can deliver its first frame. */}
            <section data-browser-workspace inert={loadingBrowser} aria-hidden={loadingBrowser || undefined} className={`grid min-w-0 min-h-app-viewport grid-cols-1 grid-rows-[auto_minmax(0,1fr)] ${loadingBrowser ? 'pointer-events-none absolute inset-x-0 top-0 opacity-0' : ''}`}>
                <header className='sticky top-0 z-40 border-b border-ui-border bg-ui-panel px-4 py-3'>
                    <div className='mx-auto flex max-w-[96rem] flex-wrap items-start justify-between gap-3'>
                        <div className='min-w-0 flex-1 basis-72'>
                            <SandboxTabStrip activeTab={activeSandboxTab} sessionState={sessionState} tools={selectedProfile.tools} toolCaptures={toolCaptures} target={normalizedTarget} domainUrl={remoteTabUrls.browser || activeUrl || normalizedTarget} siteNetwork={siteNetwork} onSelect={selectSandboxTab} />
                        </div>
                        <div className='grid min-w-0 gap-2'>
                            <div className='flex flex-wrap items-center gap-2'>
                                <StatusPill label='' value={summary.navigationFailed || sessionState === 'unreachable' ? 'unreachable' : sessionStateLabel(sessionState).replace(/^./, letter => letter.toUpperCase())} good={sessionState === 'live'} />
                                {runIsActive && socketState !== 'open' ? <StatusPill label='Connection' value={socketStateLabel(socketState)} good={false} /> : null}
                                {sessionState === 'live' && runTiming ? <span role='timer' aria-label={`${formatRunDuration(runRemainingSeconds)} remaining`}><StatusPill label='Time left' value={formatRunDuration(runRemainingSeconds)} good={runRemainingSeconds > 15} /></span> : null}
                                {sessionState === 'live' && runTiming && !runTiming.paidExtensionUsed ? (
                                    runTiming.freeExtensionUsed && !paidBrowserPlan ? (
                                        <Link href='/pricing' className='inline-flex h-9 items-center gap-2 rounded-md border border-ui-border px-3 text-sm font-semibold text-ui-text transition hover:border-ui-primary'>
                                            <Plus className='h-4 w-4' />
                                            Add 5 min · Paid
                                        </Link>
                                    ) : (
                                        <button type='button' onClick={() => extendRun(runTiming.freeExtensionUsed ? 'paid' : 'free')} className='inline-flex h-9 items-center gap-2 rounded-md border border-ui-border px-3 text-sm font-semibold text-ui-text transition hover:border-ui-primary'>
                                            <Plus className='h-4 w-4' />
                                            {runTiming.freeExtensionUsed ? 'Add 5 min · Paid' : 'Add 5 min'}
                                        </button>
                                    )
                                ) : null}
                                <button type='button' onClick={exportReport} disabled={!captures.length} className='inline-flex h-9 items-center gap-2 rounded-md border border-ui-border px-3 text-sm font-semibold text-ui-text transition hover:border-ui-primary disabled:cursor-not-allowed disabled:opacity-50'>
                                    <Download className='h-4 w-4' />
                                    Export
                                </button>
                                <button type='button' onClick={() => void saveReport()} disabled={!captures.length || !currentRunId || shareStatus === 'saving'} className='inline-flex h-9 items-center gap-2 rounded-md border border-ui-border px-3 text-sm font-semibold text-ui-text transition hover:border-ui-primary disabled:cursor-not-allowed disabled:opacity-50'>
                                    <Share2 className='h-4 w-4' />
                                    {shareStatus === 'saving' ? 'Saving' : shareStatus === 'copied' ? 'Copied' : 'Share'}
                                </button>
                                {runIsActive ? (
                                    <button type='button' onClick={stopRun} className='inline-flex h-9 items-center gap-2 rounded-md border border-ui-danger/35 bg-ui-raised/10 px-3 text-sm font-semibold text-ui-text'>
                                        <Square className='h-4 w-4' />
                                        Stop
                                    </button>
                                ) : null}
                                <button type='button' onClick={() => scrollRouteFrameToTop('smooth')} className='grid h-9 w-9 place-items-center rounded-md border border-ui-border text-ui-text transition hover:border-ui-primary sm:hidden' aria-label='Back to top' title='Back to top'>
                                    <ArrowUp className='h-4 w-4' />
                                </button>
                                <button type='button' onClick={resetRun} className='inline-flex h-9 items-center gap-2 rounded-md border border-ui-border px-3 text-sm font-semibold text-ui-text transition hover:border-ui-primary'>
                                    <ArrowLeft className='h-4 w-4' />
                                    Run another
                                </button>
                            </div>
                            {shareUrl ? <div role='region' aria-label='Share report' className='flex w-full min-w-0 flex-wrap items-center gap-2'>
                                <input aria-label='Report link' readOnly value={shareUrl} onFocus={event => event.currentTarget.select()} className='min-w-0 flex-1 rounded-md border border-ui-border bg-ui-canvas px-2 py-1.5 text-xs text-ui-text' />
                                <a href={shareUrl} target='_blank' rel='noopener noreferrer' className='text-sm text-ui-primary underline'>Open report</a>
                                <button type='button' className='rounded-md border border-ui-border px-2 py-1.5 text-sm' onClick={() => {
                                    const action = typeof navigator.share === 'function' ? navigator.share({ url: shareUrl }) : navigator.clipboard?.writeText(shareUrl)
                                    void action?.then(() => { if (typeof navigator.share !== 'function') setShareStatus('copied') }).catch(() => setShareError('Select and copy the report link above.'))
                                }}>{typeof navigator !== 'undefined' && typeof navigator.share === 'function' ? 'Share link' : 'Copy link'}</button>
                            </div> : null}
                            {shareError ? <p role='alert' className='text-sm text-ui-text'>{shareError}</p> : null}
                            {runIsActive ? <div data-browser-status className='sm:self-end' title={sessionState === 'queued' ? queueCopy(capacity) : undefined}><BrowserRunMetrics metrics={runMetrics} /></div> : null}
                        </div>
                    </div>
                </header>
                <div className='mx-auto grid min-w-0 w-full max-w-[96rem] content-start gap-4 px-4 py-4'>
                    {!runIsActive ? (
                        <div data-run-result className='w-full rounded-xl border-2 border-ui-primary/60 bg-ui-primary/10 p-5'>
                            <button type='button' aria-expanded={reportOpen} aria-controls='browser-run-evidence' onClick={() => setReportOpen(open => !open)} className='flex w-full flex-wrap items-center gap-4 text-left focus-visible:outline-2 focus-visible:outline-ui-primary'>
                                <PackageCheck className='h-10 w-10 shrink-0 text-ui-primary' />
                                <span className='min-w-40 flex-1'>
                                    <span role='status' className='block text-2xl font-semibold'>{sessionState === 'failed' ? 'Run failed' : sessionState === 'unreachable' || summary.navigationFailed ? 'Target unreachable' : stoppedRunRef.current ? stoppedEarlyRef.current ? 'Run cancelled' : 'Run done' : 'Run complete'}</span>
                                    <span className='mt-1 block text-sm text-ui-muted'>{runBlocker || summary.brief.verdict}</span>
                                </span>
                                <span className='ml-auto flex shrink-0 items-center gap-2 text-sm font-semibold text-ui-primary'>{reportOpen ? 'Close report' : 'Open report'}<ChevronDown className={`h-5 w-5 transition-transform ${reportOpen ? 'rotate-180' : ''}`} /></span>
                            </button>
                            <span className='mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-ui-primary/20 pt-3 text-xs text-ui-muted'>
                                <span>{summary.latestNetwork?.requestCount || 0} requests</span>
                                <span>{summary.latestNetwork?.uniqueDomainCount || 0} domains</span>
                                <span>{summary.latestNetwork?.downloads?.length || 0} file{summary.latestNetwork?.downloads?.length === 1 ? '' : 's'}</span>
                                {checksWithoutVerdict.length > 0 ? <button type='button' aria-expanded={reviewChecksOpen} aria-controls='checks-without-verdict' onClick={() => setReviewChecksOpen(open => !open)} className='text-ui-primary underline underline-offset-2'>{checksWithoutVerdict.length} {checksWithoutVerdict.length === 1 ? 'check' : 'checks'} without a verdict</button> : null}
                            </span>
                            {reviewChecksOpen && checksWithoutVerdict.length > 0 ? <div id='checks-without-verdict' className='mt-3'><ProviderStatusPanel tools={checksWithoutVerdict} toolCaptures={toolCaptures} target={normalizedTarget} onSelect={selectSandboxTab} /></div> : null}
                        </div>
                    ) : null}
                    {sessionState === 'failed' ? <button type='button' onClick={() => startRun({ target: normalizedTarget })} className='justify-self-start rounded-md border border-ui-primary bg-ui-primary/10 px-4 py-2 text-sm font-semibold text-ui-primary'>Try again</button> : null}
                    <div id='browser-run-evidence' hidden={!runIsActive && !reportOpen}>
                        <div className='grid min-w-0 items-start gap-4'>
                            <section className={`grid min-w-0 w-full overflow-hidden rounded-lg border border-ui-border bg-ui-panel shadow-sm ${streamUrl || activeViewportImage ? '' : 'max-w-xl justify-self-center'}`}>
                                <div
                                    ref={viewportRef}
                                    className={`relative w-full overflow-hidden overscroll-contain bg-ui-canvas outline-none focus:ring-2 focus:ring-ui-primary/30 ${streamUrl || activeViewportImage ? '' : 'min-h-40'} ${fallbackInteractive ? 'touch-none' : ''}`}
                                    style={streamUrl || activeViewportImage ? { aspectRatio: `${viewportFrame.width} / ${viewportFrame.height}` } : undefined}
                                    data-browser-viewport
                                    tabIndex={fallbackInteractive ? 0 : -1}
                                    role='application'
                                    aria-label='Interactive isolated browser viewport'
                                    onKeyDown={keyBrowserFrame}
                                >
                                    {runIsActive && streamUrl ? (
                                        <>
                                            <iframe
                                                key={streamAttempt}
                                                ref={streamRef}
                                                src={streamUrl}
                                                style={{ pointerEvents: streamHasFrame || streamNeedsGesture ? 'auto' : 'none' }}
                                                tabIndex={(streamHasFrame || streamNeedsGesture) && activeTool?.id !== 'webcrack' ? 0 : -1}
                                                title='Live WebRTC browser sandbox'
                                                className='absolute inset-0 h-full w-full border-0 bg-ui-canvas'
                                                allow='autoplay; clipboard-read; clipboard-write; fullscreen'
                                                sandbox='allow-scripts allow-same-origin allow-forms allow-pointer-lock allow-popups allow-downloads'
                                            />
                                            {activeTool?.id === 'webcrack' && activeToolCapture ? <div className='absolute inset-0 z-10 overflow-auto bg-ui-canvas p-4'><ProviderReportDetails tool={activeTool} capture={activeToolCapture} /></div> : null}
                                            {!streamHasFrame ? <div className='pointer-events-none absolute inset-0 bg-ui-canvas'>
                                                {activeViewportImage ? <img src={activeViewportImage} alt='Live browser sandbox frame' className='absolute inset-0 h-full w-full object-contain' /> : null}
                                                <div role='status' aria-label={streamNeedsGesture ? 'Tap to resume browser stream' : 'Connecting browser stream'} className='absolute inset-0 grid place-content-center justify-items-center gap-2'>
                                                    <LoaderCircle className='size-8 animate-spin text-ui-loader' />
                                                    {streamNeedsGesture ? <span className='rounded bg-ui-panel px-2 py-1 text-sm text-ui-text'>Tap to resume</span> : null}
                                                </div>
                                            </div> : null}
                                        </>
                                    ) : activeTool && activeToolCapture ? (
                                        <ProviderViewportEvidence tool={activeTool} capture={activeToolCapture} />
                                    ) : activeViewportImage ? (
                                        <img
                                            ref={imageRef}
                                            src={activeViewportImage}
                                            alt='Live browser sandbox frame'
                                            className='pointer-events-none absolute inset-0 h-full w-full cursor-pointer select-none bg-ui-canvas object-contain'
                                            draggable={false}
                                            onDragStart={event => event.preventDefault()}
                                        />
                                    ) : (
                                        <div role='status' className='grid min-h-40 place-items-center p-5'>
                                            <div className='grid max-w-md gap-2 text-center'>
                                                <ShieldCheck className='mx-auto h-8 w-8 text-ui-primary' />
                                                <p className='text-lg font-semibold text-ui-text'>{activeTool ? `${activeTool.name} tab loading` : runBlocker ? 'Browser run blocked' : waitingSeconds >= 5 ? 'Taking longer than expected...' : sessionState === 'queued' ? 'Queued for sandbox capacity' : sessionState === 'connecting' ? 'Waiting for first browser frame' : 'No browser frame captured yet'}</p>
                                                <p className='text-sm leading-6 text-ui-muted'>{activeTool ? providerDetail(activeToolCapture?.toolAnalysis, activeToolCapture) : runBlocker || (!runIsActive ? 'This run did not capture a browser frame.' : sessionState === 'queued' ? queueCopy(capacity) : waitingSeconds >= 5 ? 'The remote browser is still starting.' : 'Starting your isolated browser…')}</p>
                                                {waitingForFrame && waitingSeconds >= 10 ? <div className='mt-2 flex flex-wrap justify-center gap-2'><button type='button' onClick={() => { stopRun(); startRun({ target: normalizedTarget }) }} className='rounded-md border border-ui-primary bg-ui-primary/10 px-3 py-2 text-xs font-semibold text-ui-primary'>Try again</button><button type='button' onClick={() => window.dispatchEvent(new CustomEvent('hanasand:open-support'))} className='rounded-md border border-ui-border px-3 py-2 text-xs font-semibold text-ui-text'>Contact us</button></div> : null}
                                            </div>
                                        </div>
                                    )}
                                    {!runIsActive && !streamUrl && activeViewportImage && !activeTool ? <p className='pointer-events-none absolute bottom-2 left-2 rounded-md bg-ui-panel px-2 py-1 text-xs text-ui-muted'>Start a new run to interact</p> : null}
                                </div>
                            </section>
                            <DownloadsPanel downloads={summary.latestNetwork?.downloads || []} runIsActive={runIsActive} />

                        </div>
                        <div className='mt-4 grid min-w-0 gap-4'>
                            <EvidenceWorkspace metrics={!runIsActive ? runMetrics : undefined} captures={captures} profile={selectedProfile} target={normalizedTarget} summary={summary} consoleEvents={consoleEvents} />
                            <details className='rounded-lg border border-ui-border p-3'><summary className='cursor-pointer text-sm font-semibold'>Analyst notes and captures</summary><div className='mt-3 grid min-w-0 gap-4 xl:grid-cols-2'>
                                <AnalystSummary summary={summary} captures={captures} />
                                <CaptureTimeline captures={captures} />
                            </div></details>
                            <BrowserDebug indicatorCount={summary.indicators.length} logs={consoleEvents} />
                        </div>
                    </div>
                </div>
            </section>
        </main>
    )
}
