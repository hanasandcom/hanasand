import type { Dispatch, MouseEvent as ReactMouseEvent, RefObject, SetStateAction } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { removeCookie, setCookie } from 'hanasand/cookies'
import { DEFAULT_TERMINAL_HEIGHT, preferredTerminalHeight } from './terminalLifecycle'

type Props = {
    open: boolean
    setOpen: Dispatch<SetStateAction<boolean>>
    shareTerminalHeight: number
    triggerChange: boolean | 'close'
    setTriggerChange: Dispatch<SetStateAction<boolean | 'close'>>
    commandInputRef: RefObject<HTMLInputElement | null>
}

export function useTerminalPanelControls({
    open,
    setOpen,
    shareTerminalHeight,
    triggerChange,
    setTriggerChange,
    commandInputRef,
}: Props) {
    const [height, setHeight] = useState(shareTerminalHeight > 0 ? shareTerminalHeight : DEFAULT_TERMINAL_HEIGHT)
    const [isDragging, setIsDragging] = useState(false)
    const startY = useRef(0)
    const startHeight = useRef(0)
    const lastOpenRef = useRef(open)

    const handleMouseMove = useCallback((event: MouseEvent) => {
        if (!isDragging) return
        const delta = startY.current - event.clientY
        const nextHeight = Math.min(Math.max(startHeight.current + delta, 0), window.innerHeight * 0.9)
        setHeight(nextHeight)
    }, [isDragging])

    const handleMouseUp = useCallback(() => {
        setIsDragging(false)
        document.body.style.userSelect = ''
        if (startHeight.current > 0 && height < 50) {
            setOpen(false)
            setHeight(0)
        }
    }, [height, setOpen])

    const handleChange = useCallback(() => {
        if (open) {
            setOpen(false)
            setHeight(0)
        } else {
            setOpen(true)
            setHeight(preferredTerminalHeight(shareTerminalHeight))
        }
    }, [open, setOpen, shareTerminalHeight])

    useEffect(() => {
        if (!isDragging) {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
            document.body.style.cursor = ''
            document.body.classList.remove('dragging')
            return
        }

        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)
        document.body.style.cursor = 'row-resize'
        document.body.classList.add('dragging')
        return () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
        }
    }, [handleMouseMove, handleMouseUp, isDragging])

    useEffect(() => {
        return () => {
            if (open) setCookie('shareTerminalHeight', String(height))
            else removeCookie('shareTerminalHeight')
        }
    }, [height, open])

    useEffect(() => {
        if (triggerChange) {
            const frame = window.setTimeout(() => {
                if (triggerChange === 'close') {
                    setOpen(false)
                    setTriggerChange(false)
                    return
                }
                handleChange()
                setTriggerChange(false)
            }, 0)
            return () => window.clearTimeout(frame)
        }
    }, [handleChange, setOpen, setTriggerChange, triggerChange])

    useEffect(() => {
        if (open && !lastOpenRef.current) {
            setHeight(preferredTerminalHeight(shareTerminalHeight))
            window.setTimeout(() => commandInputRef.current?.focus(), 120)
        }
        lastOpenRef.current = open
    }, [commandInputRef, open, shareTerminalHeight])

    function handleResizeStart(event: ReactMouseEvent) {
        setIsDragging(true)
        startY.current = event.clientY
        startHeight.current = height
        document.body.style.userSelect = 'none'
    }

    return { height, isDragging, handleChange, handleResizeStart }
}
