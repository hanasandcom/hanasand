import { createServer } from 'node:net'

let supportCheck: Promise<boolean> | undefined

export function supportsLoopbackListeners() {
    supportCheck ||= probeLoopbackListener()
    return supportCheck
}

async function probeLoopbackListener() {
    const server = createServer()
    try {
        await new Promise<void>((resolve, reject) => {
            server.once('error', reject)
            server.listen(0, '127.0.0.1', resolve)
        })
        return true
    } catch (error) {
        if (isListenerUnavailableError(error)) return false
        throw new Error('Could not check local loopback listener availability.', { cause: error })
    } finally {
        if (server.listening) {
            await new Promise<void>((resolve, reject) => {
                server.close(error => error ? reject(error) : resolve())
            })
        }
    }
}

function isListenerUnavailableError(error: unknown) {
    if (!error || typeof error !== 'object' || !('code' in error)) return false
    return ['EADDRINUSE', 'EADDRNOTAVAIL', 'EACCES', 'EPERM'].includes(String(error.code))
}
