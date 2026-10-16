'use client'

import type { ReactNode } from 'react'
import { ChevronDown, Clipboard } from 'lucide-react'
import type { Capture, SandboxEvidence, SandboxNetworkSummary, SandboxTool } from '../types'
import { providerDetail, providerErrorText, providerStatus, virusTotalVendorLabel } from '../browserProviderData'

export function EvidencePanel({ title, status, children }: { title: string; status?: ReactNode; children: ReactNode }) {
    return (
        <details className='min-w-0 rounded-md border border-ui-border bg-ui-raised'>
            <summary className='flex cursor-pointer list-none items-center justify-between gap-2 p-3 text-sm [&::-webkit-details-marker]:hidden'>
                <span className='font-semibold'>{title}</span>
                <span className='flex items-center gap-2 text-xs text-ui-muted'>{status}<ChevronDown className='h-4 w-4 shrink-0' /></span>
            </summary>
            <div className='border-t border-ui-border p-3'>{children}</div>
        </details>
    )
}

export function DownloadsPanel({ downloads, runIsActive }: { downloads: NonNullable<SandboxNetworkSummary['downloads']>; runIsActive: boolean }) {
    return (
        <details className='rounded-lg border border-ui-border bg-ui-panel' open={downloads.length > 0 || undefined}>
            <summary className='cursor-pointer p-3 text-sm font-semibold'>Files <span className='ml-2 text-ui-muted'>{downloads.length}</span></summary>
            <div className='grid gap-3 border-t border-ui-border p-3'>
                {!downloads.length ? <p className='text-sm text-ui-muted'>No files captured.</p> : downloads.map((file, index) => (
                    <div key={file.id || `${file.at}-${index}`} className='grid min-w-0 gap-2 rounded-md border border-ui-border p-3'>
                        <div className='flex flex-wrap items-center justify-between gap-2'>
                            <span className='break-all text-sm font-semibold'>{file.fileName || 'Downloaded file'}</span>
                            <span className={`text-xs font-semibold ${file.virusTotal?.flagged ? 'text-ui-text' : 'text-ui-muted'}`}>
                                {file.virusTotal?.total ? `VirusTotal ${file.virusTotal.flagged || 0}/${file.virusTotal.total} detections` : file.virusTotal?.status === 'checking' && !runIsActive ? 'Lookup interrupted — no verdict' : file.virusTotal?.detail || file.virusTotal?.status || file.hashStatus || 'Downloading…'}
                            </span>
                        </div>
                        {file.sha256 ? <div className='flex min-w-0 items-center gap-2'><code className='min-w-0 flex-1 break-all text-xs text-ui-muted'>{file.sha256}</code><button type='button' aria-label={`Copy SHA-256 for ${file.fileName || 'file'}`} onClick={() => void navigator.clipboard?.writeText(file.sha256!)} className='rounded border border-ui-border p-2'><Clipboard className='h-4 w-4' /></button></div> : null}
                        <div className='flex flex-wrap gap-3 text-xs text-ui-muted'>
                            {file.bytes !== undefined ? <span>{(file.bytes / 1024).toFixed(1)} KB</span> : null}
                            {file.sha256 ? <a href={`https://www.virustotal.com/gui/file/${encodeURIComponent(file.sha256)}`} target='_blank' rel='noopener noreferrer' className='text-ui-primary underline'>Open hash report ↗</a> : null}
                        </div>
                    </div>
                ))}
            </div>
        </details>
    )
}

export function EvidenceFact({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
    return (
        <div className='min-w-0 rounded-md border border-ui-border bg-ui-panel p-2'>
            <p className='text-[10px] font-semibold uppercase text-ui-muted'>{label}</p>
            <p className={`mt-1 font-semibold text-ui-text ${mono ? 'break-all font-mono text-[11px]' : 'wrap-break-word'}`}>{value}</p>
        </div>
    )
}

export function SourceCodeDisclosure({ evidence }: { evidence?: SandboxEvidence }) {
    if (!evidence?.sourceCode) return null
    return (
        <details className='rounded-md border border-ui-border bg-ui-canvas'>
            <summary className='cursor-pointer px-2 py-1.5 text-xs font-semibold text-ui-primary'>Source code</summary>
            <pre className='max-h-56 overflow-auto whitespace-pre-wrap break-all border-t border-ui-border p-2 font-mono text-[11px] leading-5 text-ui-muted'>{evidence.sourceCode}</pre>
        </details>
    )
}

export function StatusPill({ label, value, good }: { label: string; value: string; good: boolean }) {
    return <span className={`inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-semibold ${good ? 'border-ui-success/30 bg-ui-success/10 text-ui-success' : 'border-ui-border bg-ui-panel text-ui-text'}`}>{label ? <span className='text-ui-muted'>{label}</span> : null}{value}</span>
}

export function ProviderViewportEvidence({ tool, capture }: { tool: SandboxTool; capture: Capture }) {
    if (capture.image && !capture.deobfuscatedCode) {
        return (
            <div className='h-full w-full min-w-0 overflow-auto bg-ui-canvas'>
                <img src={capture.image} alt={`${tool.name} provider screenshot`} className='block w-full min-w-0 bg-ui-panel' />
                <div className='border-t border-ui-border bg-ui-panel/95 p-3'>
                    <ProviderReportDetails tool={tool} capture={capture} compact />
                </div>
            </div>
        )
    }
    return (
        <div className='grid h-full w-full overflow-auto p-4'>
            <ProviderReportDetails tool={tool} capture={capture} />
        </div>
    )
}

export function ProviderReportDetails({ tool, capture, compact = false }: { tool: SandboxTool; capture: Capture; compact?: boolean }) {
    const analysis = capture.toolAnalysis
    if (tool.id === 'webcrack') return capture.deobfuscatedCode ? <pre className='max-h-[40rem] overflow-auto whitespace-pre-wrap break-all rounded-md border border-ui-border bg-ui-canvas p-3 font-mono text-xs text-ui-text'>{capture.deobfuscatedCode}</pre> : capture.error ? <p className='text-xs text-ui-text'>{capture.error}</p> : null
    const commentCount = analysis?.communityCommentCount
    const communityComments = analysis?.communityComments || capture.evidence?.communityComments || []
    const facts = [
        analysis?.vendorFlagged !== undefined ? ['Vendors', virusTotalVendorLabel(analysis)] : undefined,
        analysis?.alertCount !== undefined ? ['urlquery alerts', String(analysis.alertCount)] : undefined,
        commentCount !== undefined ? [commentCount === 1 ? 'Comment' : 'Comments', String(commentCount)] : undefined,
        analysis?.verdict && analysis.verdict !== 'unknown' ? ['Verdict', analysis.verdict] : undefined,
        capture.image ? ['Screenshot', 'captured'] : undefined,
        capture.error && capture.error !== 'provider_navigation_pending' ? `Error: ${providerErrorText(capture.error)}` : '',
    ].filter(Boolean) as Array<string | [string, string]>
    return (
        <div className={`grid w-full content-start gap-3 text-left ${compact ? 'text-xs' : 'rounded-md border border-ui-border bg-ui-panel p-4 shadow-sm'}`}>
            <div className='flex flex-wrap items-start justify-between gap-3'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-ui-primary'>{providerStatus(capture, analysis)}</p>
                    <h2 className={`${compact ? 'text-sm' : 'text-lg'} mt-1 font-semibold text-ui-text`}>{tool.name}</h2>
                    <a href={capture.url || tool.url} target='_blank' rel='noreferrer noopener' className='mt-1 block break-all font-mono text-xs text-ui-primary underline-offset-2 hover:underline'>{capture.url || tool.url}</a>
                </div>
                {facts.length ? (
                    <div className='flex max-w-full flex-wrap justify-end gap-2'>
                        {facts.map((fact) => Array.isArray(fact)
                            ? <div key={fact[0]} className='min-w-24 rounded-md border border-ui-border bg-ui-canvas px-2 py-1.5'><p className='text-[10px] font-semibold uppercase text-ui-muted'>{fact[0]}</p><p className='mt-0.5 font-semibold text-ui-text'>{fact[1]}</p></div>
                            : <p key={fact} className='text-ui-text'>{fact}</p>)}
                    </div>
                ) : null}
            </div>
            {capture.image && !compact ? <img src={capture.image} alt={`${tool.name} provider screenshot`} className='max-h-[32rem] w-full rounded border border-ui-border bg-ui-canvas object-contain' /> : null}
            {!facts.length ? <p className='text-sm text-ui-muted'>{providerDetail(analysis, capture)}</p> : null}
            {communityComments.length ? (
                <div className='grid gap-1.5'>
                    <p className='text-[10px] font-semibold uppercase text-ui-muted'>Community comments</p>
                    {communityComments.map((comment, index) => <blockquote key={`${index}-${comment}`} className='rounded-md border border-ui-border bg-ui-canvas px-3 py-2 text-xs leading-5 text-ui-text'>{comment}</blockquote>)}
                </div>
            ) : null}
            {commentCount && communityComments.length < commentCount ? <p className='text-xs text-ui-muted'>{commentCount - communityComments.length} additional comment{commentCount - communityComments.length === 1 ? '' : 's'} reported; the provider did not return the text.</p> : null}
            {analysis?.threatAssociations?.length ? (
                <div className='flex flex-wrap gap-1'>
                    {analysis.threatAssociations.slice(0, 4).map(item => <span key={`${item.name}-${item.source}`} className='rounded-md border border-ui-warning/30 bg-ui-warning/10 px-2 py-1 text-[11px] font-semibold text-ui-warning'>{item.name} · {item.confidence || 'low'}</span>)}
                </div>
            ) : null}
            {analysis?.extractedSignals?.length ? <pre className={`${compact ? 'max-h-24' : 'max-h-40'} overflow-auto whitespace-pre-wrap rounded-md border border-ui-border bg-ui-canvas p-2 font-mono text-xs text-ui-text`}>{analysis.extractedSignals.slice(0, compact ? 6 : 16).join('\n')}</pre> : null}
        </div>
    )
}
