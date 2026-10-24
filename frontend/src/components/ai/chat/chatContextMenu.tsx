'use client'

import { useEffect, useRef, type ReactNode } from 'react'

export type ChatContextMenuItem = {
    label: string
    icon?: ReactNode
    shortcut?: string
    danger?: boolean
    separator?: boolean
    onSelect: () => void
}

export function ChatContextMenu({
    title,
    position,
    items,
    onClose,
}: {
    title: string
    position: { x: number, y: number }
    items: ChatContextMenuItem[]
    onClose: () => void
}) {
    const menuRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        function closeWhenOutside(event: PointerEvent) {
            if (!menuRef.current?.contains(event.target as Node)) onClose()
        }
        function navigateMenu(event: KeyboardEvent) {
            if (event.key === 'Escape') onClose()
            if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
            event.preventDefault()
            const menuItems = menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')
            if (!menuItems?.length) return
            const current = Array.from(menuItems).indexOf(document.activeElement as HTMLButtonElement)
            const direction = event.key === 'ArrowDown' ? 1 : -1
            menuItems[(current + direction + menuItems.length) % menuItems.length]?.focus()
        }
        document.addEventListener('pointerdown', closeWhenOutside)
        document.addEventListener('keydown', navigateMenu)
        menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus()
        return () => {
            document.removeEventListener('pointerdown', closeWhenOutside)
            document.removeEventListener('keydown', navigateMenu)
        }
    }, [onClose])

    return (
        <div
            ref={menuRef}
            role='menu'
            aria-label={`${title} actions`}
            className='fixed z-50 max-h-[min(80vh,30rem)] w-72 overflow-y-auto rounded-2xl border border-ui-border/90 bg-ui-panel/95 p-2 text-sm text-ui-text shadow-[0_18px_56px_rgba(0,0,0,0.55)] ring-1 ring-white/5 backdrop-blur-xl'
            style={{ left: position.x, top: position.y }}
            onKeyDown={(event) => { if (event.key === 'Tab') onClose() }}
        >
            {items.map((item, index) => item.separator
                ? <div key={`separator-${index}`} role='separator' className='my-1.5 border-t border-ui-border/80' />
                : <button
                    key={`${item.label}-${index}`}
                    type='button'
                    role='menuitem'
                    onClick={item.onSelect}
                    className={`flex min-h-10 w-full items-center gap-3 rounded-xl px-2.5 text-left font-medium outline-none transition-colors hover:bg-ui-raised focus:bg-ui-raised ${item.danger ? 'text-ui-danger' : 'text-ui-text'}`}
                >
                    <span className='grid h-4 w-4 shrink-0 place-items-center text-ui-muted [&>svg]:h-4 [&>svg]:w-4'>{item.icon}</span>
                    <span className='truncate'>{item.label}</span>
                    {item.shortcut ? <kbd className='ml-auto shrink-0 rounded-md border border-ui-border/80 bg-ui-canvas/70 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-ui-muted'>{item.shortcut}</kbd> : null}
                </button>)}
        </div>
    )
}
