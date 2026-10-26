import { useEffect, useRef, useState } from 'react'
import config from '@/config'
import { getCookie } from 'hanasand/cookies'
import { prepareVmConsoleSession } from '@/utils/vms/consolePreflight'
import { openWorkspaceConsoleSocket, refreshWorkspaceConsoleTicket } from '@/utils/vms/workspaceConsoleSocket'
import { useVmConsoleBootLog } from './useVmConsoleBootLog'
import { useVmProvisioningStatus } from './useVmProvisioningStatus'
export function useVmConsoleSession(name?: string, host?: 'inspur' | 'ovh', enabled = true, organizationId?: string) {
    const container = useRef<HTMLDivElement>(null)
    const boot = useVmConsoleBootLog()
    const reconnect = useRef<() => void>(() => {})
    const [status, setStatus] = useState('Connecting…')
    const [username, setUsername] = useState('')
    const [opening, setOpening] = useState(true)
    const provisioning = useVmProvisioningStatus(name, enabled, organizationId)
    useEffect(() => {
        let disposed = false
        const controller = new AbortController()
        let socket: WebSocket | undefined, retry: ReturnType<typeof setTimeout> | undefined
        let ticketRefresh: ReturnType<typeof setInterval> | undefined
        let connectionAttempt = 0
        let disposeTerminal: (() => void) | undefined
        setStatus(host ? 'Connecting…' : 'Checking container…')
        setOpening(true)
        setUsername('')
        boot.reset()
        if (!enabled) {
            setOpening(false)
            setStatus('This VM is not available in the current workspace.')
            return () => { disposed = true; controller.abort() }
        }
        void (async () => {
            const prepared = await prepareVmConsoleSession(name, host, controller.signal, message => { if (!disposed) setStatus(message) }, error => {
                if (!disposed) { setOpening(false); setStatus(error instanceof Error ? error.message : 'Unable to open container.'); reconnect.current = () => window.location.reload() }
            })
            if (!prepared || disposed) return
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
            const connect = async () => {
                if (disposed) return
                const attempt = ++connectionAttempt
                clearTimeout(retry)
                clearInterval(ticketRefresh)
                if (socket) { socket.onclose = null; socket.close() }
                ready = false
                failed = false
                try {
                    const nextSocket = await openWorkspaceConsoleSocket(config.url.api_wss, host, name, getCookie('id') || '', decodeURIComponent(getCookie('access_token') || ''), controller.signal, () => setStatus('Opening console…'))
                    if (disposed || attempt !== connectionAttempt) { nextSocket.close(); return }
                    socket = nextSocket
                } catch (error) {
                    if (!disposed) { failed = true; setOpening(false); setStatus(error instanceof Error ? error.message : 'VM console authorization is unavailable.') }
                    return
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
                            if (!host && socket) {
                                ticketRefresh = refreshWorkspaceConsoleTicket(socket, name || '', () => {
                                    failed = true
                                    setStatus('This VM is not available in the current workspace.')
                                    socket?.close(1008)
                                })
                            }
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
                        } else if (message.type === 'boot-error') {
                            boot.setError(message.message)
                        } else if (message.type === 'closed') setStatus('Console disconnected. Reconnecting…')
                    } catch {
                        setStatus('Invalid console response. Reconnect to try again.')
                    }
                }
                socket.onerror = () => {
                    if (!disposed && !failed) setStatus('Connection lost. Reconnecting automatically…')
                }
                socket.onclose = event => {
                    ready = false
                    clearInterval(ticketRefresh)
                    if (disposed || failed || event.code === 1008) return
                    setStatus('Connection lost. Reconnecting automatically…')
                    retry = setTimeout(() => { void connect() }, 2000)
                }
            }
            reconnect.current = () => { void connect() }
            void connect()
        })().catch(() => { if (!disposed) setStatus('Unable to load the console. Try again.') })
        return () => {
            disposed = true
            controller.abort()
            clearTimeout(retry)
            clearInterval(ticketRefresh)
            reconnect.current = () => {}
            socket?.close()
            disposeTerminal?.()
        }
    }, [name, host, enabled])
    return { container, boot, reconnect, status, setStatus, username, opening, provisioning }
}
