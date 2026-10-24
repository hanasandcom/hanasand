'use client'

import { Menu } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import VMConnectLocally from './vmConnectLocally'
import VMSudoPassword from './vmSudoPassword'

type VMAccessActionsProps = { vmName: string; className?: string }
type Position = { left: number; top: number; maxHeight: number }

const EDGE_GAP = 8
const MENU_GAP = 8

export default function VMAccessActions({ vmName, className }: VMAccessActionsProps) {
    const trigger = useRef<HTMLButtonElement>(null)
    const panel = useRef<HTMLDivElement>(null)
    const closeTimer = useRef<number | null>(null)
    const [mounted, setMounted] = useState(false)
    const [open, setOpen] = useState(false)
    const [position, setPosition] = useState<Position>({ left: EDGE_GAP, top: EDGE_GAP, maxHeight: 200 })

    useEffect(() => setMounted(true), [])

    function cancelClose() {
        if (closeTimer.current !== null) window.clearTimeout(closeTimer.current)
        closeTimer.current = null
    }

    function scheduleClose() {
        cancelClose()
        closeTimer.current = window.setTimeout(() => setOpen(false), 220)
    }

    useEffect(() => () => cancelClose(), [])

    useLayoutEffect(() => {
        if (!open || !trigger.current || !panel.current) return
        const place = () => {
            const anchor = trigger.current?.getBoundingClientRect()
            const menu = panel.current
            if (!anchor || !menu) return
            const viewportWidth = document.documentElement.clientWidth
            const viewportHeight = window.innerHeight
            const width = Math.min(menu.offsetWidth, viewportWidth - EDGE_GAP * 2)
            const height = Math.min(menu.scrollHeight, viewportHeight - EDGE_GAP * 2)
            const left = Math.max(EDGE_GAP, Math.min(anchor.right - width, viewportWidth - width - EDGE_GAP))
            const below = viewportHeight - anchor.bottom - MENU_GAP - EDGE_GAP
            const above = anchor.top - MENU_GAP - EDGE_GAP
            const showBelow = below >= Math.min(height, 160) || below >= above
            const maxHeight = Math.max(1, Math.min(height, showBelow ? below : above))
            const top = showBelow
                ? Math.max(EDGE_GAP, Math.min(anchor.bottom + MENU_GAP, viewportHeight - maxHeight - EDGE_GAP))
                : Math.max(EDGE_GAP, anchor.top - MENU_GAP - maxHeight)
            setPosition({ left, top, maxHeight })
        }
        place()
        window.addEventListener('resize', place)
        window.addEventListener('scroll', place, true)
        return () => {
            window.removeEventListener('resize', place)
            window.removeEventListener('scroll', place, true)
        }
    }, [open])

    useEffect(() => {
        if (!open) return
        const onPointerDown = (event: PointerEvent) => {
            const target = event.target as Node
            if (!trigger.current?.contains(target) && !panel.current?.contains(target)) setOpen(false)
        }
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setOpen(false)
                trigger.current?.focus()
            }
        }
        document.addEventListener('pointerdown', onPointerDown)
        document.addEventListener('keydown', onKeyDown)
        return () => {
            document.removeEventListener('pointerdown', onPointerDown)
            document.removeEventListener('keydown', onKeyDown)
        }
    }, [open])

    return <div className={className || 'flex items-center gap-2'}>
        <div className='hidden items-center gap-2 lg:flex'>
            <VMConnectLocally vmName={vmName} className='inline-flex h-9 items-center gap-2 rounded-lg border border-ui-border bg-ui-panel px-3 text-sm font-medium text-ui-text transition hover:bg-ui-raised' />
            <VMSudoPassword vmName={vmName} compact triggerClassName='inline-flex h-9 items-center gap-2 rounded-lg border border-ui-border bg-ui-panel px-3 text-sm font-medium text-ui-primary transition hover:bg-ui-raised' />
        </div>
        <button
            ref={trigger}
            type='button'
            aria-label='VM access actions'
            title='VM access actions'
            aria-haspopup='menu'
            aria-expanded={open}
            onClick={() => { cancelClose(); setOpen(value => !value) }}
            onPointerLeave={event => { if (event.pointerType === 'mouse' && open) scheduleClose() }}
            onPointerEnter={cancelClose}
            className='flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-ui-border bg-ui-panel text-ui-text hover:bg-ui-raised lg:hidden'
        >
            <Menu aria-hidden='true' className='h-4 w-4' />
        </button>
        {mounted && createPortal(<div
            ref={panel}
            role='group'
            aria-label='VM access actions'
            aria-hidden={!open}
            onPointerLeave={event => { if (event.pointerType === 'mouse') scheduleClose() }}
            onPointerEnter={cancelClose}
            onClick={event => {
                if ((event.target as HTMLElement).closest('button, a')) setOpen(false)
            }}
            style={{
                display: open ? 'grid' : 'none',
                left: position.left,
                top: position.top,
                maxHeight: position.maxHeight,
            }}
            className='fixed z-[100] grid w-80 max-w-[calc(100vw_-_1rem)] gap-2 overflow-y-auto rounded-lg border border-ui-border bg-ui-panel p-2 shadow-xl'
        >
            <VMConnectLocally vmName={vmName} className='flex h-10 w-full items-center justify-start gap-2 rounded-lg border border-ui-border px-3 text-sm font-medium text-ui-text hover:bg-ui-raised' />
            <VMSudoPassword vmName={vmName} compact triggerClassName='flex h-10 w-full items-center justify-start gap-2 rounded-lg border border-ui-border px-3 text-sm font-medium text-ui-primary hover:bg-ui-raised' />
        </div>, document.body)}
    </div>
}
