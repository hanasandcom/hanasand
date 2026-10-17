import { Activity, Copy, Eye, GitBranch, Highlighter, ListOrdered, MessageSquare, Package, RefreshCw, Smartphone, TerminalSquare, X } from 'lucide-react'
import Link from 'next/link'
import type { Dispatch, ReactNode, SetStateAction } from 'react'
import copy from '@/utils/copy'
import Lock from '@/components/share/lock'
import SidebarTooltip from '../sidebarTooltip'
import type { MetadataPanel, VisibleMetadataPanel } from './panel'

const baseButtonStyle = 'grid h-10 w-10 place-items-center rounded-lg text-ui-muted transition hover:bg-ui-raised hover:text-ui-text'
const activeButtonStyle = 'bg-ui-primary/10 text-ui-primary hover:bg-ui-primary/15 hover:text-ui-primary'

type Props = {
    shareRouteId: string
    share: Share | null
    activePanel: MetadataPanel
    onTogglePanel(panel: VisibleMetadataPanel): void
    onClose(): void
    onOpenBox(): void
    editingContent: string
    didCopy: string | boolean | null
    setDidCopy: Dispatch<SetStateAction<boolean | string | null>>
    setError: Dispatch<SetStateAction<boolean | string | null>>
    setDisplayLineNumbers: Dispatch<SetStateAction<boolean>>
    syntaxHighlighting: boolean
    setSyntaxHighlighting: Dispatch<SetStateAction<boolean>>
}

export default function MetadataSidebar({
    shareRouteId,
    share,
    activePanel,
    onTogglePanel,
    onClose,
    onOpenBox,
    editingContent,
    didCopy,
    setDidCopy,
    setError,
    setDisplayLineNumbers,
    syntaxHighlighting,
    setSyntaxHighlighting,
}: Props) {
    return (
        <nav className='relative z-50 flex h-full w-14 shrink-0 flex-col items-center gap-2 overflow-visible rounded-xl border border-ui-border bg-ui-panel/90 p-2 shadow-2xl backdrop-blur-md'>
            <SidebarTooltip label='Close' side='left'>
                <button
                    type='button'
                    aria-label='Close metadata'
                    onClick={onClose}
                    className={baseButtonStyle}
                >
                    <X className='h-5 w-5' />
                </button>
            </SidebarTooltip>
            <MetadataPanelButton tooltip='Status' ariaLabel='Workspace status' panel='workspace' activePanel={activePanel} onTogglePanel={onTogglePanel} icon={<Activity className='h-5 w-5' />} />
            <MetadataPanelButton tooltip='Details' ariaLabel='Share details' panel='info' activePanel={activePanel} onTogglePanel={onTogglePanel} icon={<Eye className='h-5 w-5' />} />
            <MetadataPanelButton tooltip='Terminal' ariaLabel='Terminal access' panel='terminal' activePanel={activePanel} onTogglePanel={onTogglePanel} icon={<TerminalSquare className='h-5 w-5' />} />
            <MetadataPanelButton tooltip='Symbols' ariaLabel='Symbols' panel='symbols' activePanel={activePanel} onTogglePanel={onTogglePanel} icon={<ListOrdered className='h-5 w-5' />} />
            <SidebarTooltip label='Reload' side='left'>
                <Link
                    prefetch={false}
                    href={`/s/${share?.id || shareRouteId}`}
                    aria-label='Reload current share workspace'
                    className={baseButtonStyle}
                >
                    <RefreshCw className='h-5 w-5' />
                </Link>
            </SidebarTooltip>
            <SidebarTooltip label='Copy file' side='left'>
                <button
                    type='button'
                    aria-label='Copy current file contents'
                    onClick={() => copy({ text: editingContent, setDidCopy })}
                    className={baseButtonStyle}
                >
                    <Copy height={20} width={20} className={didCopy === true ? 'text-ui-success' : didCopy === false ? 'text-ui-text' : 'text-ui-text'} />
                </button>
            </SidebarTooltip>
            <SidebarTooltip label={share?.locked ? 'Unlock' : 'Lock'} side='left'>
                <Lock baseButtonStyle={baseButtonStyle} share={share} setError={setError} />
            </SidebarTooltip>
            <SidebarTooltip label='Line numbers' side='left'>
                <button
                    type='button'
                    aria-label='Toggle line numbers'
                    onClick={() => setDisplayLineNumbers(previous => !previous)}
                    className={baseButtonStyle}
                >
                    <ListOrdered height={20} width={20} />
                </button>
            </SidebarTooltip>
            <SidebarTooltip label='Highlighting' side='left'>
                <button
                    type='button'
                    aria-label={syntaxHighlighting ? 'Disable syntax highlighting' : 'Enable syntax highlighting'}
                    onClick={() => setSyntaxHighlighting(previous => !previous)}
                    className={baseButtonStyle}
                >
                    <Highlighter className={!syntaxHighlighting ? 'text-ui-primary' : 'text-ui-text'} height={20} width={20} />
                </button>
            </SidebarTooltip>
            <SidebarTooltip label='Tool box' side='left'>
                <button
                    type='button'
                    aria-label='Tool box'
                    onClick={onOpenBox}
                    className={buttonStyle(activePanel, 'box')}
                >
                    <Package height={20} width={20} />
                </button>
            </SidebarTooltip>
            <MetadataPanelButton tooltip='Chat' ariaLabel='Chat' panel='chat' activePanel={activePanel} onTogglePanel={onTogglePanel} icon={<MessageSquare height={20} width={20} />} />
            <MetadataPanelButton tooltip='Git' ariaLabel='Git plugin' panel='git' activePanel={activePanel} onTogglePanel={onTogglePanel} icon={<GitBranch height={20} width={20} />} />
            <MetadataPanelButton tooltip='Phone' ariaLabel='Phone simulator' panel='phone' activePanel={activePanel} onTogglePanel={onTogglePanel} icon={<Smartphone height={20} width={20} />} />
        </nav>
    )
}

function buttonStyle(activePanel: MetadataPanel, panel: VisibleMetadataPanel) {
    return `${baseButtonStyle} ${activePanel === panel ? activeButtonStyle : ''}`
}

function MetadataPanelButton({ tooltip, ariaLabel, panel, activePanel, onTogglePanel, icon }: {
    tooltip: string
    ariaLabel: string
    panel: VisibleMetadataPanel
    activePanel: MetadataPanel
    onTogglePanel(panel: VisibleMetadataPanel): void
    icon: ReactNode
}) {
    return (
        <SidebarTooltip label={tooltip} side='left'>
            <button type='button' aria-label={ariaLabel} onClick={() => onTogglePanel(panel)} className={buttonStyle(activePanel, panel)}>
                {icon}
            </button>
        </SidebarTooltip>
    )
}
