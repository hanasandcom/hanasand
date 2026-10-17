'use client'

import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'

type StreamFrame = { width: number; height: number }
type StreamMonitorOptions = {
    streamUrl: string; streamRef: MutableRefObject<HTMLIFrameElement | null>; receivedEvidenceRef: MutableRefObject<boolean>; setStreamHasFrame: Dispatch<SetStateAction<boolean>>; setStreamFrame: Dispatch<SetStateAction<StreamFrame | null>>; setStreamNeedsGesture: Dispatch<SetStateAction<boolean>>; setStreamAttempt: Dispatch<SetStateAction<number>>
}

export function useBrowserStreamMonitor({ streamUrl, streamRef, receivedEvidenceRef, setStreamHasFrame, setStreamFrame, setStreamNeedsGesture, setStreamAttempt }: StreamMonitorOptions) {
    useEffect(() => {
        setStreamHasFrame(false)
        setStreamFrame(null)
        setStreamNeedsGesture(false)
        if (!streamUrl) return
        const origin = new URL(streamUrl).origin
        let lastSignal = Date.now()
        const receive = (event: MessageEvent) => {
            if (event.source !== streamRef.current?.contentWindow || event.origin !== origin || event.data?.type !== 'hanasand-browser-stream') return
            lastSignal = Date.now()
            setStreamHasFrame(event.data.state === 'ready')
            setStreamNeedsGesture(event.data.state === 'gesture')
            const { width, height } = event.data
            if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0 && width <= 8192 && height <= 8192) setStreamFrame({ width, height })
            if (event.data.state === 'ready') {
                receivedEvidenceRef.current = true
                setStreamHasFrame(true)
            }
        }
        window.addEventListener('message', receive)
        const monitor = window.setInterval(() => {
            if (document.visibilityState !== 'visible') { lastSignal = Date.now(); return }
            if (Date.now() - lastSignal > 5000) setStreamHasFrame(false)
            if (Date.now() - lastSignal > 15000) {
                lastSignal = Date.now()
                setStreamAttempt(attempt => attempt + 1)
            }
        }, 1000)
        return () => { window.removeEventListener('message', receive); window.clearInterval(monitor) }
    }, [streamUrl])
}
