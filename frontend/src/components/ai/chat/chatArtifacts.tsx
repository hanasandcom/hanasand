import { useState } from 'react'
import Image from 'next/image'
import { ExternalLink, X } from 'lucide-react'

const artifactKindLabels: Record<AIArtifact['kind'], { singular: string, group: string }> = {
    screenshot: { singular: 'Screenshot', group: 'Screenshots' },
    command: { singular: 'Command', group: 'Command output' },
    http: { singular: 'HTTP', group: 'HTTP checks' },
    log: { singular: 'Log', group: 'Logs' },
    file: { singular: 'File', group: 'Files' },
    link: { singular: 'Link', group: 'Links' },
    diff: { singular: 'Diff', group: 'Diffs' },
}

export function ArtifactList({
    artifacts,
    forceExpanded = false,
    onPreview,
}: {
    artifacts: AIArtifact[]
    forceExpanded?: boolean
    onPreview: (artifact: AIArtifact | null) => void
}) {
    if (!artifacts.length) {
        return null
    }

    return (
        <div className='mt-3 grid gap-3 border-t border-ui-border pt-3'>
            {artifacts.map((artifact, index) => (
                <details
                    key={`${artifact.kind}-${artifact.title}-${index}`}
                    open={forceExpanded || index === artifacts.length - 1}
                    className='rounded-lg border border-ui-border bg-ui-panel p-3'
                >
                    <summary className='cursor-pointer list-none'>
                        <div className='flex items-center justify-between gap-3'>
                            <div>
                                <div className='text-[10px] uppercase tracking-[0.16em] text-ui-muted'>{artifactKindLabel(artifact.kind)}</div>
                                <div className='mt-1 text-sm font-medium text-ui-text'>{artifact.title}</div>
                            </div>
                            <div className='flex items-center gap-2'>
                                {artifact.kind === 'screenshot' ? (
                                    <div className='rounded-full bg-ui-raised px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-ui-muted'>
                                        Verification
                                    </div>
                                ) : null}
                                {index === artifacts.length - 1 ? (
                                    <div className='rounded-full bg-ui-raised px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-ui-muted'>
                                        Newest
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </summary>
                    {artifact.url ? (
                        <a href={artifact.url} target='_blank' rel='noopener noreferrer' className='mt-2 inline-flex items-center gap-1.5 text-xs text-ui-muted hover:underline'>
                            {artifact.url}
                            <ExternalLink className='h-3.5 w-3.5' />
                        </a>
                    ) : null}
                    {artifact.dataUrl ? (
                        <button type='button' onClick={() => onPreview(artifact)} className='mt-3 block w-full text-left'>
                            <Image src={artifact.dataUrl} alt={artifact.title} width={1200} height={800} className='max-h-72 w-full rounded-lg object-contain outline outline-ui-border transition hover:opacity-92' />
                            <div className='mt-2 text-xs text-ui-muted'>Open full-size preview</div>
                        </button>
                    ) : null}
                    {artifact.kind === 'diff' && artifact.content ? (
                        <DiffArtifact content={artifact.content} />
                    ) : artifact.content ? (
                        <ArtifactTextContent artifact={artifact} />
                    ) : null}
                </details>
            ))}
        </div>
    )
}

function ArtifactTextContent({ artifact }: { artifact: AIArtifact }) {
    const [expanded, setExpanded] = useState(false)
    const lines = (artifact.content || '').split('\n')
    const shouldCollapse = (artifact.kind === 'log' || artifact.kind === 'command') && lines.length > 18
    const visibleContent = shouldCollapse && !expanded ? lines.slice(0, 18).join('\n') : artifact.content || ''

    return (
        <div className='mt-3'>
            <pre className='max-h-72 overflow-auto rounded-lg bg-ui-canvas p-3 text-xs leading-5 text-ui-muted'>{visibleContent}</pre>
            {shouldCollapse ? (
                <button
                    type='button'
                    onClick={() => setExpanded((prev) => !prev)}
                    className='mt-2 text-xs text-ui-muted hover:underline'
                >
                    {expanded ? 'Collapse output' : `Expand full output (${lines.length} lines)`}
                </button>
            ) : null}
        </div>
    )
}

export function ArtifactPreviewOverlay({
    artifact,
    onClose,
}: {
    artifact: AIArtifact | null
    onClose: () => void
}) {
    if (!artifact?.dataUrl) {
        return null
    }

    return (
        <div className='fixed inset-0 z-200 flex items-center justify-center bg-ui-canvas/82 p-4 backdrop-blur-sm' onClick={onClose}>
            <div className='w-full max-w-6xl rounded-lg bg-ui-canvas p-4 outline outline-ui-border/10' onClick={(event) => event.stopPropagation()}>
                <div className='mb-3 flex items-center justify-between gap-3'>
                    <div>
                        <div className='text-[10px] uppercase tracking-[0.16em] text-ui-muted'>{artifactKindLabel(artifact.kind)}</div>
                        <div className='mt-1 text-sm font-medium text-ui-text'>{artifact.title}</div>
                    </div>
                    <button type='button' onClick={onClose} className='rounded-lg bg-ui-raised p-2 text-ui-muted outline outline-ui-border/10 transition hover:text-ui-text'>
                        <X className='h-4 w-4' />
                    </button>
                </div>
                <div className='overflow-auto rounded-lg bg-ui-raised p-3'>
                    <Image src={artifact.dataUrl} alt={artifact.title} width={1600} height={1200} className='max-h-[78vh] w-full object-contain' />
                </div>
            </div>
        </div>
    )
}

function DiffArtifact({ content }: { content: string }) {
    const lines = content.split('\n')
    return (
        <div className='mt-3 max-h-80 overflow-auto rounded-lg bg-ui-canvas/25 p-3 text-xs leading-5'>
            {lines.map((line, index) => (
                <div
                    key={`${line}-${index}`}
                    className={`whitespace-pre-wrap break-all rounded px-2 ${line.startsWith('+') ? 'bg-ui-success/10 text-ui-success' : line.startsWith('-') ? 'bg-ui-raised/10 text-ui-text' : 'text-ui-muted'}`}
                >
                    {line || ' '}
                </div>
            ))}
        </div>
    )
}

export function groupArtifacts(artifacts: AIArtifact[]) {
    const order: AIArtifact['kind'][] = ['screenshot', 'command', 'http', 'log', 'file', 'link', 'diff']

    return order
        .map((kind) => ({
            kind,
            label: artifactKindLabels[kind].group,
            artifacts: artifacts.filter((artifact) => artifact.kind === kind),
        }))
        .filter((group) => group.artifacts.length > 0)
}

function artifactKindLabel(kind: AIArtifact['kind']) {
    return artifactKindLabels[kind]?.singular || kind
}
