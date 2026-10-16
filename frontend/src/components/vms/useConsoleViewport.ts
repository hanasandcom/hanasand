import { useEffect, useRef, useState, type CSSProperties } from 'react'

export function useConsoleViewport(onFullscreenError: (message: string) => void) {
    const panel = useRef<HTMLElement>(null)
    const [nativeFullscreen, setNativeFullscreen] = useState(false)
    const [expanded, setExpanded] = useState(false)
    const [viewport, setViewport] = useState<CSSProperties>()
    const fullscreen = nativeFullscreen || expanded

    useEffect(() => {
        const changed = () => setNativeFullscreen(document.fullscreenElement === panel.current)
        document.addEventListener('fullscreenchange', changed)
        return () => document.removeEventListener('fullscreenchange', changed)
    }, [])

    useEffect(() => {
        if (!expanded) return
        const frame = panel.current?.closest<HTMLElement>('[data-route-frame]')
        const previousLayer = frame?.style.zIndex || ''
        if (frame) frame.style.zIndex = '1000'
        const previousOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        const visible = window.visualViewport
        const resize = () => setViewport({
            top: visible?.offsetTop || 0,
            left: visible?.offsetLeft || 0,
            width: visible?.width || window.innerWidth,
            height: visible?.height || window.innerHeight,
        })
        const escape = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return
            event.preventDefault()
            event.stopPropagation()
            setExpanded(false)
        }
        resize()
        visible?.addEventListener('resize', resize)
        visible?.addEventListener('scroll', resize)
        window.addEventListener('resize', resize)
        document.addEventListener('keydown', escape, true)
        return () => {
            document.body.style.overflow = previousOverflow
            if (frame) frame.style.zIndex = previousLayer
            visible?.removeEventListener('resize', resize)
            visible?.removeEventListener('scroll', resize)
            window.removeEventListener('resize', resize)
            document.removeEventListener('keydown', escape, true)
        }
    }, [expanded])

    async function toggleFullscreen() {
        if (expanded) {
            setExpanded(false)
            return
        }
        if (document.fullscreenElement === panel.current) {
            await document.exitFullscreen().catch(() => onFullscreenError('Use your browser’s fullscreen control to exit.'))
            return
        }
        try {
            if (!panel.current?.requestFullscreen || document.fullscreenEnabled === false) {
                setExpanded(true)
                return
            }
            await panel.current.requestFullscreen()
        } catch {
            // Keep the mounted terminal and connection while filling the browser area.
            setExpanded(true)
        }
    }

    return { panel, expanded, viewport, fullscreen, toggleFullscreen }
}
