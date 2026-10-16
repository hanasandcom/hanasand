import { ExternalLink, ScanSearch } from 'lucide-react'
import type { BrowserEvidence } from './shareChatTypes'
import { emptyBrowserStructure, journeyTypeLabels } from './shareChatPresentation'

export function BrowserEvidenceCard({ evidence }: { evidence: BrowserEvidence }) {
    const structure = evidence.structure || emptyBrowserStructure()
    const issues = evidence.pageErrors?.filter(Boolean) || []
    const journey = evidence.journeyProof
    const journeyLabels = journeyTypeLabels(journey)
    return (
        <article className='overflow-hidden rounded-2xl border border-ui-border bg-ui-canvas/24'>
            <div className='flex items-center justify-between gap-3 border-b border-ui-border px-3 py-2'>
                <div className='flex min-w-0 items-center gap-2'>
                    <ScanSearch className='h-4 w-4 shrink-0 text-ui-primary' />
                    <div className='min-w-0'>
                        <p className='truncate text-sm font-semibold text-ui-text/84'>Browser check</p>
                        <p className='truncate text-xs text-ui-text/42'>{issues.length ? 'Needs a fix before publishing.' : 'Rendered screenshot and safe journey checks finished.'}</p>
                    </div>
                </div>
                <a href={evidence.url} target='_blank' rel='noopener noreferrer' className='grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ui-text/52 transition hover:bg-ui-panel/8 hover:text-ui-text' aria-label='Open checked page'>
                    <ExternalLink className='h-4 w-4' />
                </a>
            </div>
            <div className='border-b border-ui-border px-3 py-2 text-xs leading-5 text-ui-text/58'>
                <p>Browser check finished for {evidence.url}.</p>
            </div>
            <div className='grid gap-2 p-3 text-xs text-ui-text/62 sm:grid-cols-2'>
                <EvidenceList title='Visible sections' items={structure.headings} />
                <EvidenceList title='Links found' items={(structure.links || []).map((link) => [link.text, link.href].filter(Boolean).join(' -> '))} />
                <EvidenceList title='Actions found' items={structure.buttons} />
                <EvidenceList title='Forms found' items={[...(structure.inputs || []), ...(structure.forms || [])]} />
                <div className='rounded-lg border border-ui-border bg-ui-canvas/16 p-2'>
                    <p className='text-[10px] font-semibold uppercase tracking-[0.18em] text-ui-text/38'>Phone readiness</p>
                    <p className='mt-1 text-ui-text/72'>{structure.hasViewportMeta ? 'Viewport meta present' : 'Viewport meta missing or unknown'}</p>
                </div>
                <div className='rounded-lg border border-ui-border bg-ui-canvas/16 p-2'>
                    <p className='text-[10px] font-semibold uppercase tracking-[0.18em] text-ui-text/38'>Screenshot</p>
                    <p className='mt-1 text-ui-text/72'>{evidence.screenshotPath ? 'Saved for review' : 'Screenshot not available yet'}</p>
                </div>
                <div className='rounded-lg border border-ui-border bg-ui-canvas/16 p-2'>
                    <p className='text-[10px] font-semibold uppercase tracking-[0.18em] text-ui-text/38'>Journey check</p>
                    <p className='mt-1 text-ui-text/72'>{journey?.readiness?.submitWithoutMutationAvoided ? 'Dry-run completed safely' : journey ? 'Rendered journey inspected' : 'Not available yet'}</p>
                </div>
                <div className='rounded-lg border border-ui-border bg-ui-canvas/16 p-2'>
                    <p className='text-[10px] font-semibold uppercase tracking-[0.18em] text-ui-text/38'>Critical path</p>
                    <p className='mt-1 text-ui-text/72'>{journeyLabels.length ? journeyLabels.join(', ') : 'No specific journey detected'}</p>
                </div>
                <details className='rounded-lg border border-ui-border bg-ui-canvas/16 p-2 sm:col-span-2'>
                    <summary className='cursor-pointer text-[10px] font-semibold uppercase tracking-[0.18em] text-ui-text/38'>Advanced details</summary>
                    <div className='mt-2 grid gap-2 sm:grid-cols-2'>
                        <EvidenceList title='Page address' items={[evidence.url]} />
                        <EvidenceList title='Journey dry run' items={journey ? [
                            `${journey.filledControls || 0}/${journey.fillableControls || 0} fields safely filled`,
                            `${journey.focusedControls || 0}/${journey.controls || 0} controls focus-tested`,
                            `Mutation avoided: ${journey.readiness?.submitWithoutMutationAvoided ? 'yes' : 'unknown'}`,
                        ] : []} />
                        <EvidenceList title='Console messages' items={evidence.consoleMessages} />
                        <EvidenceList title='Page errors' items={issues} />
                    </div>
                </details>
            </div>
            {issues.length ? (
                <div className='border-t border-ui-border px-3 py-2 text-xs text-ui-text/78'>
                    <p className='font-medium'>Page issues: {issues.length}.</p>
                    <p className='mt-1 whitespace-pre-wrap'>{issues.slice(0, 3).join('\n')}</p>
                </div>
            ) : null}
        </article>
    )
}

export function EvidenceList({ title, items }: { title: string, items?: string[] }) {
    const visible = (items || []).filter(Boolean).slice(0, 4)
    return (
        <div className='rounded-lg border border-ui-border bg-ui-canvas/16 p-2'>
            <p className='text-[10px] font-semibold uppercase tracking-[0.18em] text-ui-text/38'>{title}</p>
            <ul className='mt-1 space-y-0.5 text-ui-text/72'>
                {visible.length ? visible.map((item) => <li key={item} className='truncate'>{item}</li>) : <li>&lt;none&gt;</li>}
            </ul>
        </div>
    )
}
