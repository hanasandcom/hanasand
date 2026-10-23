// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { decodedFpsFromMessage, streamStatsFromMessage } from '../src/app/sandbox/_browser/browser/components/useBrowserStreamMonitor'

test('reads only valid, nonnegative WebRTC receiver counters from the stream message', () => {
    const message = {
        type: 'hanasand-browser-stream',
        fps: 60,
        peerConnectionState: 'connected',
        iceConnectionState: 'connected',
        candidatePairState: 'succeeded',
        localCandidateType: 'relay',
        remoteCandidateType: 'relay',
        videoPacketsReceived: 0,
        videoBytesReceived: 0,
        videoFramesDecoded: 0,
        videoFramesPerSecond: 0,
        address: '192.0.2.10',
        credential: 'not forwarded',
    }

    expect(decodedFpsFromMessage(message)).toBe(60)
    expect(streamStatsFromMessage(message)).toEqual({
        peerConnectionState: 'connected',
        iceConnectionState: 'connected',
        candidatePairState: 'succeeded',
        localCandidateType: 'relay',
        remoteCandidateType: 'relay',
        videoPacketsReceived: 0,
        videoBytesReceived: 0,
        videoFramesDecoded: 0,
        videoFramesPerSecond: 0,
    })
})

test('rejects malformed or unrelated stream telemetry', () => {
    expect(streamStatsFromMessage({ type: 'other', peerConnectionState: 'connected' })).toBeUndefined()
    expect(streamStatsFromMessage({ type: 'hanasand-browser-stream', iceConnectionState: 'x'.repeat(33), videoFramesDecoded: -1, videoBytesReceived: Number.NaN })).toEqual({})
    expect(streamStatsFromMessage(null)).toBeUndefined()
})
