import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import type { RequestOptions } from 'node:http'
import { publicMonitoringRequest, type MonitoringResolver } from '../src/utils/publicMonitoringRequest.ts'

export const publicAddresses = [{ address: '93.184.215.14', family: 4 }]
export const resolver: MonitoringResolver = async () => publicAddresses
export const options = { followRedirects: true, timeoutMs: 500, readBody: true }
export type Send = NonNullable<Parameters<typeof publicMonitoringRequest>[3]>

export function mockSend(replies: { status?: number, statusText?: string, location?: string, encoding?: string, body?: string | Buffer, hang?: boolean }[]) {
    const calls: { url: URL, options: RequestOptions }[] = []
    const send: Send = (url, requestOptions, callback) => {
        calls.push({ url, options: requestOptions })
        const reply = replies[calls.length - 1] || {}
        const request = new EventEmitter() as ReturnType<Send>
        const response = Object.assign(new PassThrough(), {
            statusCode: reply.status || 200,
            statusMessage: reply.statusText,
            headers: { location: reply.location, 'content-encoding': reply.encoding },
        })
        request.destroy = (error?: Error) => { if (error) request.emit('error', error); response.destroy(); return request }
        request.end = (() => {
            queueMicrotask(() => {
                callback(response as Parameters<Parameters<Send>[2]>[0])
                if (!reply.hang) response.end(reply.body ?? '{"ok":true}')
            })
            return request
        }) as typeof request.end
        const abort = () => request.destroy(new Error('aborted'))
        requestOptions.signal?.addEventListener('abort', abort, { once: true })
        response.once('close', () => requestOptions.signal?.removeEventListener('abort', abort))
        return request
    }
    return { send, calls }
}
