import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import Notify from '@/components/notify/notify'
import type { VisibleMetadataPanel } from './panel'

type Props = {
    panel: VisibleMetadataPanel
    error: string | boolean | null
    onHide(): void
    children: ReactNode
}

export default function MetadataPanelShell({ panel, error, onHide, children }: Props) {
    return (
        <div className={`relative z-10 min-w-0 h-full ${panelWidth(panel)}`}>
            <div className='h-full w-full max-w-full space-y-2 overflow-y-auto overflow-x-hidden rounded-xl border border-ui-border bg-ui-panel/90 p-2 shadow-2xl backdrop-blur-md'>
                <header className='flex items-center justify-between rounded-lg border border-ui-border bg-ui-raised px-3 py-2 text-ui-text'>
                    <span className='text-[11px] font-semibold uppercase tracking-[0.22em] text-ui-muted'>{panelTitle(panel)}</span>
                    <button type='button' aria-label='Hide metadata panel' onClick={onHide} className='grid h-8 w-8 place-items-center rounded-lg text-ui-muted transition hover:bg-ui-panel hover:text-ui-text'>
                        <X className='h-4 w-4' />
                    </button>
                </header>
                <Notify message={error} />
                {children}
            </div>
        </div>
    )
}

function panelWidth(panel: VisibleMetadataPanel) {
    if (panel === 'box') return 'w-[min(72rem,calc(100vw-5.5rem))] lg:w-[min(72rem,56vw)]'
    if (panel === 'chat') return 'w-[min(42rem,calc(100vw-5.5rem))] lg:w-[min(42rem,34vw)]'
    if (panel === 'phone') return 'w-[min(30rem,calc(100vw-5.5rem))]'
    return 'w-[min(24rem,calc(100vw-5.5rem))] lg:w-[min(24rem,21vw)]'
}

function panelTitle(panel: VisibleMetadataPanel) {
    const titles: Record<VisibleMetadataPanel, string> = {
        workspace: 'Workspace status', info: 'Share details', terminal: 'Terminal access', symbols: 'Symbols',
        git: 'Git', phone: 'Phone preview', box: 'Tool box', chat: 'Chat',
    }
    return titles[panel]
}
