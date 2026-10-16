'use client'

import type { Capture, SandboxEvidence, SandboxNetworkSummary, SandboxProfile } from '../types'
import BrowserRunMetrics, { type RunMetrics } from '../BrowserRunMetrics'
import { networkPeerSummary } from '../browserAnalystSummary'
import { networkPeerLabel, downloadEvidenceLine } from '../browserRunData'
import { selectToolCapture, providerStatus, virusTotalVendorLabel } from '../browserProviderData'
import { buildAnalystSummary } from '../browserAnalystSummary'
import { StatusPill, ProviderReportDetails, EvidencePanel, DownloadsPanel, EvidenceFact, SourceCodeDisclosure } from './EvidencePrimitives'
import { meaningfulReasons } from './AnalystMetadata'

export function EvidenceWorkspace({
    metrics,
    captures,
    profile,
    target,
    summary,
    consoleEvents,
}: {
    metrics?: RunMetrics
    captures: Capture[]
    profile: SandboxProfile
    target: string
    summary: ReturnType<typeof buildAnalystSummary>
    consoleEvents: string[]
}) {
    const pageCaptures = captures.filter(capture => capture.kind === 'page')
    const toolCaptures = captures.filter(capture => capture.kind === 'tool')
    const screenshots = pageCaptures.filter(capture => capture.image)
    const latestPage = pageCaptures[0]
    const latestNetwork = pageCaptures.find(capture => capture.networkSummary)?.networkSummary
    const confirmedNetworkIndicators = (toolCaptures.find(capture => capture.toolAnalysis?.toolKind === 'virustotal')?.toolAnalysis?.vendorFlagged || 0) >= 10 ? 1 : 0
    const suspiciousNetworkIndicators = Math.max(0, summary.indicators.length - confirmedNetworkIndicators)
    const sourceUrls = [...new Set(pageCaptures.flatMap(capture => capture.evidence?.sourceUrls || []))]
    const networkRequests = [...new Map([...pageCaptures].reverse().flatMap(capture => capture.networkSummary?.recentRequests || []).map(request => [`${request.at}-${request.method}-${request.url}`, request])).values()]
    const scriptHashCount = new Set(pageCaptures.flatMap(capture => [
        ...(capture.evidence?.scripts || []).map(script => script.sha256),
        ...(capture.evidence?.deobfuscationTasks || []).map(task => task.sha256),
    ]).filter(Boolean)).size

    return (
        <section className='min-h-0 min-w-0 overflow-hidden rounded-lg border border-ui-border bg-ui-panel'>
            <div className='border-b border-ui-border px-4 py-3'>
                <h2 className='text-sm font-semibold text-ui-primary'>Details</h2>
            </div>
            <div className='grid gap-2 p-3'>
                <EvidencePanel title='Statistics'>
                    {metrics ? <div className='mb-3'><BrowserRunMetrics metrics={metrics} /></div> : null}
                    <div className='grid gap-2 text-xs text-ui-muted sm:grid-cols-2'>
                        <EvidenceFact label='Final URL' value={summary.urlTimeline.at(-1)?.url || latestPage?.url || 'unknown'} mono />
                        <EvidenceFact label='URL states' value={String(summary.urlTimeline.length || pageCaptures.length || 0)} />
                        <EvidenceFact label='Redirects' value={String(latestNetwork?.redirectChain?.length || 0)} />
                        <EvidenceFact label='Contacted domains' value={latestNetwork?.domains?.slice(0, 4).join('  ') || 'none yet'} mono />
                        <EvidenceFact label='DNS / IP / certificate peers' value={String(networkPeerSummary(latestNetwork).length)} />
                        <EvidenceFact label='Network requests' value={String(latestNetwork?.requestCount || 0)} />
                        <EvidenceFact label='Hashed downloads' value={String(latestNetwork?.downloads?.filter(download => download.sha256).length || 0)} />
                        <EvidenceFact label='Script hashes' value={String(scriptHashCount)} />
                        <EvidenceFact label='Provider captures' value={`${toolCaptures.length}/${profile.tools.length}`} />
                        <EvidenceFact label='Copyable indicators' value={String(summary.indicators.length)} />
                    </div>
                </EvidencePanel>

                <div className='grid gap-3 md:grid-cols-3'>
                    {profile.tools.map(tool => {
                        const capture = selectToolCapture(toolCaptures, tool, target)
                        const analysis = capture?.toolAnalysis
                        if (tool.id === 'webcrack' && !capture?.deobfuscatedCode && !capture?.webcrackLoad?.loaded && !capture?.webcrackLoad?.sampleBytes) return null
                        return (
                            <EvidencePanel key={tool.id} title={tool.name} status={analysis?.vendorFlagged !== undefined ? <span className={analysis.vendorFlagged >= 10 ? 'text-ui-text' : analysis.vendorFlagged > 0 ? 'text-ui-warning' : 'text-ui-success'}>{virusTotalVendorLabel(analysis)}</span> : analysis?.alertCount !== undefined ? <span className={analysis.alertCount > 0 ? 'text-ui-warning' : 'text-ui-success'}>{analysis.alertCount}</span> : providerStatus(capture, analysis)}>
                                {capture ? (
                                    <ProviderReportDetails tool={tool} capture={capture} compact />
                                ) : (
                                    <p className='text-xs leading-5 text-ui-muted'>Provider unavailable: this profile tool has not returned a capture or parsed result for this run.</p>
                                )}
                            </EvidencePanel>
                        )
                    })}
                </div>

                {summary.deobfuscationTasks.length > 0 || summary.webcrackLoaded ? <EvidencePanel title='WebCrack / decoded code' status={summary.webcrackLoaded ? 'Code loaded' : 'No decoded result'}>
                    {summary.deobfuscationTasks.length ? (
                        <div className='grid gap-2 text-xs text-ui-muted'>
                            {summary.deobfuscationTasks.slice(0, 4).map(task => (
                                <div key={`${task.scriptId}-${task.source}`} className='rounded-md border border-ui-border bg-ui-panel p-2'>
                                    <p className='font-semibold text-ui-text'>{task.scriptId || 'obfuscated code'} · {task.assessment || 'review required'}</p>
                                    {task.sha256 ? <p className='mt-1 break-all font-mono text-[11px] text-ui-text'>sha256 {task.sha256}</p> : null}
                                    <p className='mt-1 leading-5'>{task.summary || task.decodedPreview || 'Decoded summary unavailable.'}</p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className='text-xs leading-5 text-ui-muted'>No obfuscated code was found on this page.</p>
                    )}
                </EvidencePanel> : null}

                <EvidencePanel title='Network / requests' status={<><span>{latestNetwork?.requestCount || 0}</span>{suspiciousNetworkIndicators > 0 ? <span className='text-ui-warning' aria-label={`${suspiciousNetworkIndicators} suspicious indicators`}>{suspiciousNetworkIndicators}</span> : null}{confirmedNetworkIndicators > 0 ? <span className='text-ui-text' aria-label={`${confirmedNetworkIndicators} indicators with 10 or more VirusTotal detections`}>{confirmedNetworkIndicators}</span> : null}</>}>
                    {latestNetwork ? (
                        <div className='grid gap-2 text-xs text-ui-muted'>
                            <p>{latestNetwork.requestCount || 0} requests · {latestNetwork.responseCount || 0} responses · {latestNetwork.failedCount || 0} blocked/failed</p>
                            {latestNetwork.domains?.length ? <p className='break-all font-mono text-ui-text'>{latestNetwork.domains.slice(0, 8).join('\n')}</p> : null}
                            {latestNetwork.redirectChain?.length ? <pre className='max-h-20 overflow-auto whitespace-pre-wrap rounded-md border border-ui-border bg-ui-panel p-2 font-mono text-[11px] text-ui-text'>Redirects:{'\n'}{latestNetwork.redirectChain.join('\n')}</pre> : null}
                            {latestNetwork.downloads?.length ? <pre className='max-h-28 overflow-auto whitespace-pre-wrap rounded-md border border-ui-border bg-ui-panel p-2 font-mono text-[11px] text-ui-text'>Downloads:{'\n'}{latestNetwork.downloads.map(downloadEvidenceLine).filter(Boolean).join('\n\n')}</pre> : null}
                            {networkRequests.length ? (
                                <div className='max-h-56 overflow-auto rounded-md border border-ui-border'>
                                    <table className='w-full min-w-[48rem] border-collapse text-left text-[11px]'>
                                        <thead className='sticky top-0 bg-ui-raised text-ui-muted'>
                                            <tr>
                                                <th className='border-b border-ui-border px-2 py-1'>Method</th>
                                                <th className='border-b border-ui-border px-2 py-1'>Status</th>
                                                <th className='border-b border-ui-border px-2 py-1'>Host</th>
                                                <th className='border-b border-ui-border px-2 py-1'>MIME</th>
                                                <th className='border-b border-ui-border px-2 py-1'>Time</th>
                                                <th className='border-b border-ui-border px-2 py-1'>DNS / ASN / TLS</th>
                                                <th className='border-b border-ui-border px-2 py-1'>Initiator</th>
                                                <th className='border-b border-ui-border px-2 py-1'>Block reason</th>
                                                <th className='border-b border-ui-border px-2 py-1'>URL</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {networkRequests.map((request, index) => (
                                                <tr key={`${request.at}-${request.url}-${index}`}>
                                                    <td className='border-b border-ui-border/60 px-2 py-1'>{request.method || 'GET'}{request.resourceType ? ` · ${request.resourceType}` : ''}</td>
                                                    <td className='border-b border-ui-border/60 px-2 py-1'>{request.failure ? 'Blocked/failed' : request.status || ''}</td>
                                                    <td className='max-w-36 truncate border-b border-ui-border/60 px-2 py-1 font-mono text-ui-muted'>{request.host || ''}</td>
                                                    <td className='max-w-36 truncate border-b border-ui-border/60 px-2 py-1'>{request.mimeType || ''}</td>
                                                    <td className='border-b border-ui-border/60 px-2 py-1'>{request.durationMs !== undefined ? `${request.durationMs}ms` : ''}</td>
                                                    <td className='border-b border-ui-border/60 px-2 py-1 font-mono text-ui-muted'>{networkPeerLabel(request)}</td>
                                                    <td className='max-w-48 truncate border-b border-ui-border/60 px-2 py-1 font-mono text-ui-muted'>{request.initiator || ''}</td>
                                                    <td className='max-w-48 truncate border-b border-ui-border/60 px-2 py-1 text-ui-text'>{request.failure || ''}</td>
                                                    <td className='max-w-[28rem] truncate border-b border-ui-border/60 px-2 py-1 font-mono text-ui-text'>{request.url}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : null}
                        </div>
                    ) : (
                        <p className='text-xs leading-5 text-ui-muted'>No request summary has been emitted by the browser broker yet.</p>
                    )}
                    {sourceUrls.length ? <div className='mt-3 grid gap-1 text-xs'><p className='font-semibold'>URLs found in source</p><pre className='max-h-40 overflow-auto whitespace-pre-wrap break-all font-mono text-ui-muted'>{sourceUrls.join('\n')}</pre></div> : null}
                </EvidencePanel>

                <EvidencePanel title='Screenshots' status={String(screenshots.length)}>
                    {pageCaptures.length ? (
                        <div className='grid gap-2 text-xs text-ui-muted'>
                            {screenshots.map(capture => (
                                <div key={capture.id} className='grid gap-2 rounded-md border border-ui-border bg-ui-panel p-2'>
                                    <p>{capture.capturedAt}{capture.reason ? ` · ${capture.reason}` : ''}</p>
                                    <p className='truncate font-mono text-ui-text'>{capture.url}</p>
                                    <SourceCodeDisclosure evidence={capture.evidence} />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className='text-xs leading-5 text-ui-muted'>No page capture available yet.</p>
                    )}
                </EvidencePanel>

                <EvidencePanel title='Console logs' status={String(consoleEvents.length)}>
                    {consoleEvents.length ? (
                        <div className='grid max-h-96 gap-2 overflow-auto text-xs text-ui-muted'>
                            {consoleEvents.map((event, index) => <p key={index} className='wrap-break-word whitespace-pre-wrap font-mono'>{event}</p>)}
                        </div>
                    ) : (
                        <p className='text-xs leading-5 text-ui-muted'>No console output was emitted by the inspected page.</p>
                    )}
                </EvidencePanel>



                {summary.indicators.length > 0 ? <EvidencePanel title='Indicators' status={String(summary.indicators.length)}>
                    <pre className='max-h-28 overflow-auto whitespace-pre-wrap rounded-md border border-ui-border bg-ui-canvas p-2 text-xs text-ui-text'>{summary.indicators.join('\n')}</pre>
                </EvidencePanel> : null}
            </div>
        </section>
    )
}
