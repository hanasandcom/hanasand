'use client'

import { useCallback, useEffect, useRef, type KeyboardEvent, type RefObject } from 'react'
import type { BrowserControlSocket } from '../controlSocket'

type BrowserViewportInputOptions = {
    activeFrame: { width: number; height: number }
    fallbackInteractive: boolean
    socketRef: RefObject<BrowserControlSocket | null>
}

export function useBrowserViewportInput({ activeFrame, fallbackInteractive, socketRef }: BrowserViewportInputOptions) {
    const viewportRef = useRef<HTMLDivElement | null>(null)
    const imageRef = useRef<HTMLImageElement | null>(null)
    const touchFrameRef = useRef<{ clientX: number; clientY: number; lastX: number; lastY: number; moved: boolean } | null>(null)
    const sendBrowserInput = useCallback((payload: Record<string, unknown>) => {
        const socket = socketRef.current
        if (!socket || socket.readyState !== WebSocket.OPEN) return
        socket.send(JSON.stringify(payload))
    }, [])

    const browserPoint = useCallback((clientX: number, clientY: number) => {
        const image = imageRef.current
        if (!image) return null
        const rect = image.getBoundingClientRect()
        if (!rect.width || !rect.height) return null
        const scale = Math.min(rect.width / activeFrame.width, rect.height / activeFrame.height)
        const left = rect.left + (rect.width - activeFrame.width * scale) / 2
        const top = rect.top + (rect.height - activeFrame.height * scale) / 2
        if (clientX < left || clientX > left + activeFrame.width * scale || clientY < top || clientY > top + activeFrame.height * scale) return null
        const x = Math.min(activeFrame.width - 1, Math.round((clientX - left) / scale))
        const y = Math.min(activeFrame.height - 1, Math.round((clientY - top) / scale))
        return { x, y }
    }, [activeFrame.height, activeFrame.width])

    const eventInsideViewport = useCallback((clientX: number, clientY: number) => {
        const viewport = viewportRef.current
        if (!viewport) return false
        const rect = viewport.getBoundingClientRect()
        return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom
    }, [])

    const keyBrowserFrame = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
        if (!fallbackInteractive) return
        const keyPayload = {
            type: 'key',
            key: event.key,
            ctrlKey: event.ctrlKey,
            metaKey: event.metaKey,
            altKey: event.altKey,
            shiftKey: event.shiftKey,
        }
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'v') {
            event.preventDefault()
            void navigator.clipboard?.readText?.()
                .then(text => {
                    sendBrowserInput({ type: 'clipboard', direction: 'browser-to-remote', text })
                    sendBrowserInput(keyPayload)
                })
                .catch(() => sendBrowserInput(keyPayload))
            return
        }
        if (event.metaKey || event.ctrlKey || event.altKey || event.key.length === 1 || ['Enter', 'Tab', 'Backspace', 'Delete', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
            sendBrowserInput(keyPayload)
            if (event.key !== 'Tab') event.preventDefault()
        }
    }, [fallbackInteractive, sendBrowserInput])

    useEffect(() => {
        const viewport = viewportRef.current
        if (!viewport || !fallbackInteractive) return
        const wheelBrowserFrame = (event: globalThis.WheelEvent) => {
            const rect = viewport.getBoundingClientRect()
            if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return
            const scrollRoot = document.scrollingElement
            const scrollLeft = scrollRoot?.scrollLeft ?? window.scrollX
            const scrollTop = scrollRoot?.scrollTop ?? window.scrollY
            viewport.focus()
            const point = browserPoint(event.clientX, event.clientY)
            if (!point) return
            event.preventDefault()
            event.stopPropagation()
            sendBrowserInput({ type: 'wheel', ...point, deltaX: event.deltaX, deltaY: event.deltaY })
            requestAnimationFrame(() => {
                if (scrollRoot) scrollRoot.scrollTo(scrollLeft, scrollTop)
                else window.scrollTo(scrollLeft, scrollTop)
            })
        }
        viewport.addEventListener('wheel', wheelBrowserFrame, { capture: true, passive: false })
        return () => viewport.removeEventListener('wheel', wheelBrowserFrame, { capture: true })
    }, [fallbackInteractive, browserPoint, sendBrowserInput])

    useEffect(() => {
        const viewport = viewportRef.current
        if (!viewport || !fallbackInteractive) return
        const capturePointerFrame = (event: globalThis.PointerEvent) => {
            if (event.pointerType === 'touch' || !eventInsideViewport(event.clientX, event.clientY)) return
            const point = browserPoint(event.clientX, event.clientY)
            if (!point) return
            event.preventDefault()
            event.stopPropagation()
            viewportRef.current?.focus()
            sendBrowserInput({ type: 'pointer', event: event.type, ...point, button: event.button, buttons: event.buttons })
        }
        const captureTouchFrame = (event: globalThis.TouchEvent) => {
            const touch = event.changedTouches[0]
            if (!touch || !eventInsideViewport(touch.clientX, touch.clientY)) return
            const point = browserPoint(touch.clientX, touch.clientY)
            if (!point) return
            event.preventDefault()
            event.stopPropagation()
            viewportRef.current?.focus()

            if (event.type === 'touchstart') {
                touchFrameRef.current = { clientX: touch.clientX, clientY: touch.clientY, lastX: touch.clientX, lastY: touch.clientY, moved: false }
                return
            }

            const touchState = touchFrameRef.current
            if (!touchState) return
            const deltaX = touch.clientX - touchState.lastX
            const deltaY = touch.clientY - touchState.lastY
            touchState.lastX = touch.clientX
            touchState.lastY = touch.clientY
            if (Math.abs(touch.clientX - touchState.clientX) > 6 || Math.abs(touch.clientY - touchState.clientY) > 6) touchState.moved = true

            if (event.type === 'touchmove') {
                sendBrowserInput({ type: 'wheel', ...point, deltaX: -deltaX, deltaY: -deltaY })
                return
            }

            if (!touchState.moved && event.type === 'touchend') sendBrowserInput({ type: 'click', ...point, button: 0 })
            touchFrameRef.current = null
        }
        viewport.addEventListener('pointerdown', capturePointerFrame, { capture: true })
        viewport.addEventListener('pointermove', capturePointerFrame, { capture: true })
        viewport.addEventListener('pointerup', capturePointerFrame, { capture: true })
        viewport.addEventListener('touchstart', captureTouchFrame, { capture: true, passive: false })
        viewport.addEventListener('touchmove', captureTouchFrame, { capture: true, passive: false })
        viewport.addEventListener('touchend', captureTouchFrame, { capture: true, passive: false })
        viewport.addEventListener('touchcancel', captureTouchFrame, { capture: true, passive: false })
        return () => {
            viewport.removeEventListener('pointerdown', capturePointerFrame, { capture: true })
            viewport.removeEventListener('pointermove', capturePointerFrame, { capture: true })
            viewport.removeEventListener('pointerup', capturePointerFrame, { capture: true })
            viewport.removeEventListener('touchstart', captureTouchFrame, { capture: true })
            viewport.removeEventListener('touchmove', captureTouchFrame, { capture: true })
            viewport.removeEventListener('touchend', captureTouchFrame, { capture: true })
            viewport.removeEventListener('touchcancel', captureTouchFrame, { capture: true })
        }
    }, [fallbackInteractive, browserPoint, eventInsideViewport, sendBrowserInput])

    return { viewportRef, imageRef, keyBrowserFrame }
}
