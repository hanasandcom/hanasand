'use client'

import { useEffect, useRef, type ReactNode } from 'react'

export type ChatContextMenuItem = {
    label: string
    icon?: ReactNode
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
            className='fixed z-50 max-h-[min(80vh,30rem)] w-56 overflow-y-auto rounded-lg border border-ui-border bg-ui-panel p-1.5 text-sm text-ui-text shadow-2xl'
            style={{ left: position.x, top: position.y }}
            onKeyDown={(event) => { if (event.key === 'Tab') onClose() }}
        >
            {items.map((item, index) => item.separator
                ? <div key={`separator-${index}`} role='separator' className='my-1 border-t border-ui-border' />
                : <button
                    key={`${item.label}-${index}`}
                    type='button'
                    role='menuitem'
                    onClick={item.onSelect}
                    className={`flex min-h-9 w-full items-center gap-2 rounded-md px-2 text-left outline-none hover:bg-ui-raised focus:bg-ui-raised ${item.danger ? 'text-ui-danger' : 'text-ui-text'}`}
                >
                    <span className='grid h-4 w-4 shrink-0 place-items-center [&>svg]:h-4 [&>svg]:w-4'>{item.icon}</span>
                    <span className='truncate'>{item.label}</span>
                </button>)}
        </div>
    )
}
