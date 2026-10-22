'use client'

import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import type { StreamStats } from '../types'

type StreamFrame = { width: number; height: number }
type StreamMonitorOptions = {
    streamUrl: string; streamRef: MutableRefObject<HTMLIFrameElement | null>; receivedEvidenceRef: MutableRefObject<boolean>; setStreamHasFrame: Dispatch<SetStateAction<boolean>>; setStreamFrame: Dispatch<SetStateAction<StreamFrame | null>>; setStreamNeedsGesture: Dispatch<SetStateAction<boolean>>; setStreamStats: Dispatch<SetStateAction<StreamStats>>
}

export function keepsStreamFrame(hasRenderedFrame: boolean, nextState: string) {
    return hasRenderedFrame || nextState === 'ready'
}

export function decodedFpsFromMessage(value: unknown) {
    if (!value || typeof value !== 'object') return undefined
    const message = value as { type?: unknown; fps?: unknown }
    if (message.type !== 'hanasand-browser-stream' || typeof message.fps !== 'number' || !Number.isFinite(message.fps) || message.fps < 0 || message.fps > 120) return undefined
    return message.fps
}

export function useBrowserStreamMonitor({ streamUrl, streamRef, receivedEvidenceRef, setStreamHasFrame, setStreamFrame, setStreamNeedsGesture, setStreamStats }: StreamMonitorOptions) {
    useEffect(() => {
        setStreamHasFrame(false)
        setStreamFrame(null)
        setStreamNeedsGesture(false)
        if (!streamUrl) return
        const origin = new URL(streamUrl).origin
        let hasRenderedFrame = false
        const receive = (event: MessageEvent) => {
            if (event.source !== streamRef.current?.contentWindow || event.origin !== origin || event.data?.type !== 'hanasand-browser-stream') return
            if (keepsStreamFrame(hasRenderedFrame, event.data.state)) {
                hasRenderedFrame = true
                receivedEvidenceRef.current = true
                setStreamHasFrame(true)
                setStreamNeedsGesture(false)
            } else if (event.data.state === 'gesture' && !hasRenderedFrame) {
                setStreamNeedsGesture(true)
            } else if (!hasRenderedFrame) {
                setStreamHasFrame(false)
                setStreamNeedsGesture(false)
            }
            const fps = decodedFpsFromMessage(event.data)
            if (fps !== undefined) setStreamStats(current => ({ ...current, fps }))
            const { width, height } = event.data
            if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0 && width <= 8192 && height <= 8192) setStreamFrame({ width, height })
        }
        window.addEventListener('message', receive)
        return () => window.removeEventListener('message', receive)
    }, [streamUrl, streamRef, receivedEvidenceRef, setStreamHasFrame, setStreamFrame, setStreamNeedsGesture, setStreamStats])
}
