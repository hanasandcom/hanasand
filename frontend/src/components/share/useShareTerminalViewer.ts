import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import { useCallback, useEffect, useRef } from 'react'
import { writeTerminalChunks } from './terminalOutput'

type UseShareTerminalViewerOptions = {
    open: boolean
    shareId: string
    chunks: string[]
    sendInput: (message: string) => { status: boolean, message?: string }
    sendResize: (cols: number, rows: number) => void
}

export function useShareTerminalViewer({ open, shareId, chunks, sendInput, sendResize }: UseShareTerminalViewerOptions) {
    const containerRef = useRef<HTMLDivElement>(null)
    const terminalRef = useRef<Terminal | null>(null)
    const fitAddonRef = useRef<FitAddon | null>(null)
    const renderedChunkCountRef = useRef(0)
    const latestChunksRef = useRef(chunks)
    const resizeObserverRef = useRef<ResizeObserver | null>(null)
    const fitTimeoutRef = useRef<number | null>(null)
    const lastSizeRef = useRef({ cols: 0, rows: 0 })

    const clearScheduledFit = useCallback(() => {
        if (fitTimeoutRef.current === null) return
        window.clearTimeout(fitTimeoutRef.current)
        fitTimeoutRef.current = null
    }, [])

    const scheduleFit = useCallback((focus = false, delay = 0) => {
        clearScheduledFit()
        fitTimeoutRef.current = window.setTimeout(() => {
            window.requestAnimationFrame(() => {
                fitTimeoutRef.current = null
                const container = containerRef.current
                const terminal = terminalRef.current
                const fitAddon = fitAddonRef.current
                if (!container || !terminal || !fitAddon) return

                const { height, width } = container.getBoundingClientRect()
                if (width < 80 || height < 40) return

                try {
                    fitAddon.fit()
                    if (focus) terminal.focus()
                    const nextSize = { cols: terminal.cols, rows: terminal.rows }
                    if (nextSize.cols !== lastSizeRef.current.cols || nextSize.rows !== lastSizeRef.current.rows) {
                        lastSizeRef.current = nextSize
                        sendResize(nextSize.cols, nextSize.rows)
                    }
                } catch {
                    // xterm can be briefly unmeasurable while its panel is hidden.
                }
            })
        }, delay)
    }, [clearScheduledFit, sendResize])

    useEffect(() => {
        latestChunksRef.current = chunks
    }, [chunks])

    useEffect(() => {
        const container = containerRef.current
        if (!container || terminalRef.current) return

        const styles = getComputedStyle(document.documentElement)
        const colorValue = (name: string) => styles.getPropertyValue(name).trim()
        const terminal = new Terminal({
            cursorBlink: true,
            convertEol: false,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace',
            fontSize: 14,
            lineHeight: 1.35,
            theme: {
                background: colorValue('--ui-canvas'),
                foreground: colorValue('--ui-text'),
                cursor: colorValue('--ui-success'),
                selectionBackground: colorValue('--ui-selection'),
            },
        })
        const fitAddon = new FitAddon()
        terminal.loadAddon(fitAddon)
        terminal.open(container)
        terminalRef.current = terminal
        fitAddonRef.current = fitAddon

        const shareTerminalWindow = window as Window & {
            __shareTerminal?: Terminal
            __shareTerminalSendInput?: (content: string) => void
        }
        shareTerminalWindow.__shareTerminal = terminal
        shareTerminalWindow.__shareTerminalSendInput = content => { sendInput(content) }

        const inputDisposable = terminal.onData(data => { sendInput(data) })
        writeTerminalChunks(terminal, latestChunksRef.current)
        renderedChunkCountRef.current = latestChunksRef.current.length

        const refit = () => scheduleFit()
        const refitWithFocus = () => scheduleFit(true, 50)
        const refitWhenVisible = () => {
            if (document.visibilityState === 'visible') scheduleFit(true, 80)
        }
        resizeObserverRef.current = new ResizeObserver(refit)
        resizeObserverRef.current.observe(container)
        window.addEventListener('focus', refitWithFocus)
        window.addEventListener('pageshow', refitWithFocus)
        window.addEventListener('resize', refit)
        document.addEventListener('visibilitychange', refitWhenVisible)
        scheduleFit(true, 80)

        return () => {
            clearScheduledFit()
            resizeObserverRef.current?.disconnect()
            resizeObserverRef.current = null
            window.removeEventListener('focus', refitWithFocus)
            window.removeEventListener('pageshow', refitWithFocus)
            window.removeEventListener('resize', refit)
            document.removeEventListener('visibilitychange', refitWhenVisible)
            inputDisposable.dispose()
            terminal.dispose()
            terminalRef.current = null
            fitAddonRef.current = null
            lastSizeRef.current = { cols: 0, rows: 0 }
            delete shareTerminalWindow.__shareTerminal
            delete shareTerminalWindow.__shareTerminalSendInput
        }
    }, [clearScheduledFit, scheduleFit, sendInput])

    useEffect(() => {
        const terminal = terminalRef.current
        if (!terminal) return
        terminal.reset()
        renderedChunkCountRef.current = 0
        scheduleFit()
    }, [scheduleFit, shareId])

    useEffect(() => {
        const terminal = terminalRef.current
        if (!terminal) return
        writeTerminalChunks(terminal, chunks.slice(renderedChunkCountRef.current))
        renderedChunkCountRef.current = chunks.length
    }, [chunks, shareId])

    useEffect(() => {
        if (open && terminalRef.current) scheduleFit(true, 200)
    }, [open, scheduleFit])

    const focusTerminal = useCallback(() => terminalRef.current?.focus(), [])
    return { containerRef, focusTerminal }
}
