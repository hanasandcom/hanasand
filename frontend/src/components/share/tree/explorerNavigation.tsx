import { Files, Folder, Search, X } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'
import SidebarTooltip from '../sidebarTooltip'

type ExplorerNavigationProps = {
    showExplorer: boolean
    activePanel: 'files' | 'search'
    setActivePanel: Dispatch<SetStateAction<'files' | 'search'>>
    setShowExplorer: Dispatch<SetStateAction<boolean>>
    position: { x: number, y: number }
    onMouseDown: (event: React.MouseEvent<HTMLDivElement>) => void
    onOpen: () => void
}

export function ExplorerNavigation({
    showExplorer,
    activePanel,
    setActivePanel,
    setShowExplorer,
    position,
    onMouseDown,
    onOpen,
}: ExplorerNavigationProps) {
    if (!showExplorer) {
        return (
            <div
                onMouseDown={onMouseDown}
                className='absolute z-100 grid gap-2 rounded-lg border border-ui-border bg-ui-panel/95 p-2 shadow-lg shadow-ui-canvas/10 backdrop-blur-md max-md:bottom-16 max-md:left-2 max-md:top-auto md:bg-ui-panel/90'
                style={{ top: position.y, left: position.x }}
            >
                <SidebarTooltip label='Files'>
                    <button
                        type='button'
                        aria-label='Open file explorer'
                        onClick={() => {
                            setActivePanel('files')
                            onOpen()
                        }}
                        className='group grid h-11 w-11 place-items-center rounded-lg text-ui-muted transition hover:bg-ui-raised hover:text-ui-text'
                    >
                        <Folder />
                    </button>
                </SidebarTooltip>
                <SidebarTooltip label='Search'>
                    <button
                        type='button'
                        aria-label='Open workspace search'
                        onClick={() => {
                            setActivePanel('search')
                            onOpen()
                        }}
                        className='group grid h-11 w-11 place-items-center rounded-lg text-ui-muted transition hover:bg-ui-raised hover:text-ui-text'
                    >
                        <Search />
                    </button>
                </SidebarTooltip>
            </div>
        )
    }

    return (
        <nav className='relative z-50 flex h-full w-14 shrink-0 flex-col items-center gap-2 overflow-visible rounded-lg border border-ui-border bg-ui-panel/95 p-2 shadow-lg shadow-ui-canvas/10 backdrop-blur-md md:bg-ui-panel/90'>
            <SidebarTooltip label='Close'>
                <button type='button' aria-label='Close left sidebar' onClick={() => setShowExplorer(false)} className='grid h-10 w-10 place-items-center rounded-lg text-ui-muted transition hover:bg-ui-raised hover:text-ui-text'>
                    <X className='h-5 w-5' />
                </button>
            </SidebarTooltip>
            <SidebarTooltip label='Files'>
                <button
                    type='button'
                    aria-label='Files'
                    onClick={() => {
                        if (activePanel === 'files') {
                            setShowExplorer(false)
                            return
                        }
                        setActivePanel('files')
                    }}
                    className={`grid h-10 w-10 place-items-center rounded-lg transition ${activePanel === 'files' ? 'bg-ui-primary/10 text-ui-primary hover:bg-ui-primary/15' : 'text-ui-muted hover:bg-ui-raised hover:text-ui-text'}`}
                >
                    <Files className='h-5 w-5' />
                </button>
            </SidebarTooltip>
            <SidebarTooltip label='Search'>
                <button
                    type='button'
                    aria-label='Search and replace'
                    onClick={() => {
                        if (activePanel === 'search') {
                            setShowExplorer(false)
                            return
                        }
                        setActivePanel('search')
                    }}
                    className={`grid h-10 w-10 place-items-center rounded-lg transition ${activePanel === 'search' ? 'bg-ui-primary/10 text-ui-primary hover:bg-ui-primary/15' : 'text-ui-muted hover:bg-ui-raised hover:text-ui-text'}`}
                >
                    <Search className='h-5 w-5' />
                </button>
            </SidebarTooltip>
        </nav>
    )
}
