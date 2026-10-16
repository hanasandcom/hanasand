import { useEffect } from 'react'

type MutableValue<T> = { current: T }
type ZoomAtPoint = (value: number, clientX?: number, clientY?: number) => void

export function useDependencyMapGestures(
    viewport: MutableValue<HTMLDivElement | null>,
    zoom: MutableValue<number>,
    dragged: MutableValue<boolean>,
    changeZoom: ZoomAtPoint,
) {
    useEffect(() => {
        const element = viewport.current
        if (!element) return

        let previous: { x: number, y: number, distance: number } | null = null
        let gestureZoom = 1
        const position = (touches: TouchList) => {
            const first = touches[0]
            const second = touches[1] || first
            return {
                x: (first.clientX + second.clientX) / 2,
                y: (first.clientY + second.clientY) / 2,
                distance: Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY),
            }
        }
        const start = (event: TouchEvent) => {
            dragged.current = false
            previous = position(event.touches)
        }
        const move = (event: TouchEvent) => {
            if (!previous || !event.touches.length) return
            event.preventDefault()
            const next = position(event.touches)
            if (next.distance && previous.distance) {
                changeZoom(zoom.current * next.distance / previous.distance, next.x, next.y)
                dragged.current = true
            } else {
                const dx = previous.x - next.x
                const dy = previous.y - next.y
                element.scrollBy(dx, dy)
                if (Math.abs(dx) + Math.abs(dy) > 2) dragged.current = true
            }
            previous = next
        }
        const end = (event: TouchEvent) => {
            previous = event.touches.length ? position(event.touches) : null
        }
        const wheel = (event: WheelEvent) => {
            if (!event.ctrlKey) return
            event.preventDefault()
            changeZoom(zoom.current * Math.exp(-event.deltaY * 0.01), event.clientX, event.clientY)
        }
        // Safari trackpads report gesture events instead of Ctrl+wheel.
        const gestureStart = (event: Event) => {
            event.preventDefault()
            gestureZoom = zoom.current
        }
        const gestureChange = (event: Event) => {
            event.preventDefault()
            const gesture = event as Event & { scale: number, clientX: number, clientY: number }
            if (Number.isFinite(gesture.scale)) {
                changeZoom(gestureZoom * gesture.scale, gesture.clientX, gesture.clientY)
            }
        }

        element.addEventListener('wheel', wheel, { passive: false })
        element.addEventListener('touchstart', start, { passive: true })
        element.addEventListener('touchmove', move, { passive: false })
        element.addEventListener('touchend', end)
        element.addEventListener('touchcancel', end)
        element.addEventListener('gesturestart', gestureStart)
        element.addEventListener('gesturechange', gestureChange)
        return () => {
            element.removeEventListener('wheel', wheel)
            element.removeEventListener('touchstart', start)
            element.removeEventListener('touchmove', move)
            element.removeEventListener('touchend', end)
            element.removeEventListener('touchcancel', end)
            element.removeEventListener('gesturestart', gestureStart)
            element.removeEventListener('gesturechange', gestureChange)
        }
    }, [changeZoom, dragged, viewport, zoom])
}
