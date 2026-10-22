import { useEffect, useRef, useState } from 'react'
import config from '@/config'
import { getCookie } from 'hanasand/cookies'
import { authenticateConsoleSocket, vmConsoleSocketUrl } from '@/utils/vms/authenticateConsoleSocket'
import { prepareVmConsole } from '@/utils/vms/prepareConsole'
import { useVmConsoleBootLog } from './useVmConsoleBootLog'
import { useVmProvisioningStatus } from './useVmProvisioningStatus'
export function useVmConsoleSession(name?: string, host?: 'inspur' | 'ovh') {
    const container = useRef<HTMLDivElement>(null)
    const boot = useVmConsoleBootLog()
    const reconnect = useRef<() => void>(() => {})
    const [status, setStatus] = useState('Connecting…')
    const [username, setUsername] = useState('')
    const [opening, setOpening] = useState(true)
    const provisioning = useVmProvisioningStatus(name)
    useEffect(() => {
        let disposed = false
        const controller = new AbortController()
        let socket: WebSocket | undefined, retry: ReturnType<typeof setTimeout> | undefined
        let disposeTerminal: (() => void) | undefined
        setStatus(host ? 'Connecting…' : 'Checking container…')
        setOpening(true)
        setUsername('')
        boot.reset()
        void (async () => {
            try {
                const provisioning = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('provisioning') === '1'
                if (!host && !provisioning) {
                    if (!name) throw new Error('Select a virtual machine to open its console.')
                    await prepareVmConsole(
                        name,
                        config.url.api,
                        getCookie('id') || '',
                        decodeURIComponent(getCookie('access_token') || ''),
                        message => { if (!disposed) setStatus(message) },
                        AbortSignal.any([controller.signal, AbortSignal.timeout(120000)]),
                    )
                }
            } catch (error) {
                if (!disposed) {
                    setOpening(false)
                    setStatus(error instanceof Error ? error.message : 'Unable to open container.')
                    reconnect.current = () => window.location.reload()
                }
                return
            }
            if (disposed) return
            const [{ Terminal }, { FitAddon }] = await Promise.all([
                import('@xterm/xterm'),
                import('@xterm/addon-fit'),
            ])
            if (disposed || !container.current) return
            const palette = getComputedStyle(document.documentElement)
            const terminal = new Terminal({
                cursorBlink: true,
                fontSize: 14,
                scrollback: 5000,
                theme: {
                    background: palette.getPropertyValue('--ui-canvas').trim(),
                    foreground: palette.getPropertyValue('--ui-text').trim(),
                    cursor: palette.getPropertyValue('--ui-primary').trim(),
                    selectionBackground: palette.getPropertyValue('--ui-selection').trim(),
                },
            })
            const fit = new FitAddon()
            terminal.loadAddon(fit)
            terminal.open(container.current)
            const selection = terminal.onSelectionChange(() => {
                const textarea = terminal.textarea
                if (!textarea) return
                textarea.value = terminal.getSelection()
                textarea.setSelectionRange(0, textarea.value.length)
            })
            terminal.attachCustomKeyEventHandler(event => {
                const copy = event.key.toLowerCase() === 'c' && !event.altKey
                    && (event.metaKey || (event.ctrlKey && event.shiftKey))
                if (!copy || !terminal.hasSelection()) return true
                if (event.type === 'keydown') {
                    event.preventDefault()
                    if (!document.execCommand('copy')) {
                        setStatus('Could not copy. Use the terminal’s right-click menu to try again.')
                    }
                }
                return false
            })
            let followOutput = true
            let pendingWrites = 0
            const scroll = terminal.onScroll(position => {
                if (!pendingWrites) followOutput = position >= terminal.buffer.active.baseY
            })
            const stopFollowing = (event: WheelEvent) => {
                if (event.deltaY < 0) followOutput = false
            }
            const terminalElement = container.current
            terminalElement.addEventListener('wheel', stopFollowing, { passive: true })
            let ready = false
            let failed = false
            const sendSize = () => {
                if (disposed) return
                const following = followOutput
                fit.fit()
                if (following) terminal.scrollToBottom()
                if (ready && socket?.readyState === WebSocket.OPEN) {
                    socket.send(JSON.stringify({ type: 'resize', cols: terminal.cols, rows: terminal.rows }))
                }
            }
            const observer = new ResizeObserver(sendSize)
            observer.observe(container.current)
            const input = terminal.onData(data => {
                followOutput = true
                terminal.scrollToBottom()
                if (ready && socket?.readyState === WebSocket.OPEN) {
                    socket.send(JSON.stringify({ type: 'input', data }))
                }
            })
            disposeTerminal = () => {
                observer.disconnect()
                terminalElement.removeEventListener('wheel', stopFollowing)
                input.dispose()
                selection.dispose()
                scroll.dispose()
                terminal.dispose()
            }
            const connect = () => {
                if (disposed) return
                clearTimeout(retry)
                if (socket) { socket.onclose = null; socket.close() }
                ready = false
                failed = false
                socket = new WebSocket(vmConsoleSocketUrl(config.url.api_wss, host, name))
                socket.onopen = () => {
                    const token = decodeURIComponent(getCookie('access_token') || '')
                    const target = vmConsoleSocketUrl(config.url.api_wss, host, name)
                    void authenticateConsoleSocket(socket, target, getCookie('id') || '', token).catch(() => socket?.close())
                    setStatus('Opening console…')
                }
                socket.onmessage = event => {
                    if (disposed) return
                    try {
                        const message = JSON.parse(event.data)
                        if (message.type === 'output') {
                            pendingWrites++
                            terminal.write(message.data, () => {
                                if (!disposed && followOutput) terminal.scrollToBottom()
                                pendingWrites--
                            })
                        } else if (message.type === 'ready') {
                            ready = true
                            setUsername(message.username)
                            setStatus('Connected')
                            setOpening(false)
                            sendSize()
                            terminal.focus()
                        } else if (message.type === 'error') {
                            failed = true
                            setOpening(false)
                            setStatus(message.message)
                        } else if (message.type === 'status') {
                            ready = false
                            setStatus(message.message)
                            if (!host && message.message !== 'Opening console…') boot.setExpanded(true)
                        } else if (message.type === 'boot-output') {
                            boot.setError('')
                            boot.setOutput(previous => (previous + message.data).slice(-65536))
                        } else if (message.type === 'boot-error') boot.setError(message.message)
                        else if (message.type === 'closed') setStatus('Console disconnected. Reconnecting…')
                    } catch {
                        setStatus('Invalid console response. Reconnect to try again.')
                    }
                }
                socket.onerror = () => {
                    if (!disposed && !failed) setStatus('Connection lost. Reconnecting automatically…')
                }
                socket.onclose = event => {
                    ready = false
                    if (disposed || failed || event.code === 1008) return
                    setStatus('Connection lost. Reconnecting automatically…')
                    retry = setTimeout(connect, 2000)
                }
            }
            reconnect.current = connect
            connect()
        })().catch(() => { if (!disposed) setStatus('Unable to load the console. Try again.') })
        return () => {
            disposed = true
            controller.abort()
            clearTimeout(retry)
            reconnect.current = () => {}
            socket?.close()
            disposeTerminal?.()
        }
    }, [name, host])
    return { container, boot, reconnect, status, setStatus, username, opening, provisioning }
}
