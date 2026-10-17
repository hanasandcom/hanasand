import { mkdir, rename, rm, stat } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { LOCK_PATH, RECOVERY_LOCK_PATH } from './webScannerModel.ts'

const LOCK_STALE_MS = 10 * 60 * 1000

export async function withWebScanLock<T>(work: () => Promise<T>): Promise<T> {
    let reclaimedPath: string | undefined
    while (true) {
        try {
            await mkdir(LOCK_PATH)
            break
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
            let lockAge: number
            try {
                lockAge = Date.now() - (await stat(LOCK_PATH)).mtimeMs
            } catch (statError) {
                if ((statError as NodeJS.ErrnoException).code === 'ENOENT') continue
                throw statError
            }
            if (lockAge > LOCK_STALE_MS) {
                try {
                    await mkdir(RECOVERY_LOCK_PATH)
                } catch (recoveryError) {
                    if ((recoveryError as NodeJS.ErrnoException).code === 'EEXIST') throw Object.assign(new Error('Hanasand web scan is already running.'), { cause: recoveryError })
                    throw recoveryError
                }
                try {
                    let currentAge: number
                    try {
                        currentAge = Date.now() - (await stat(LOCK_PATH)).mtimeMs
                    } catch (statError) {
                        if ((statError as NodeJS.ErrnoException).code === 'ENOENT') continue
                        throw statError
                    }
                    if (currentAge <= LOCK_STALE_MS) throw Object.assign(new Error('Hanasand web scan is already running.'), { cause: error })
                    const candidate = `${LOCK_PATH}.reclaim-${randomUUID()}`
                    await rename(LOCK_PATH, candidate)
                    reclaimedPath = candidate
                    try {
                        await mkdir(LOCK_PATH)
                    } catch (error) {
                        await rm(candidate, { recursive: true, force: true })
                        reclaimedPath = undefined
                        throw error
                    }
                    break
                } finally {
                    await rm(RECOVERY_LOCK_PATH, { recursive: true, force: true })
                }
            }
            throw Object.assign(new Error('Hanasand web scan is already running.'), { cause: error })
        }
    }
    const acquiredLock = await stat(LOCK_PATH)
    let result: T
    try {
        result = await work()
    } catch (error) {
        await releaseWebScanLock(acquiredLock, reclaimedPath)
        throw error
    }
    await releaseWebScanLock(acquiredLock, reclaimedPath)
    return result
}

async function releaseWebScanLock(acquiredLock: Awaited<ReturnType<typeof stat>>, reclaimedPath?: string) {
    // Serialize cleanup with reclaimers so an old owner cannot remove a replacement lock.
    let ownsRecoveryLock = false
    try {
        try {
            await mkdir(RECOVERY_LOCK_PATH)
            ownsRecoveryLock = true
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
        }
        if (ownsRecoveryLock) {
            const currentLock = await stat(LOCK_PATH).catch(error => {
                if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
                throw error
            })
            if (currentLock?.dev === acquiredLock.dev && currentLock.ino === acquiredLock.ino) {
                await rm(LOCK_PATH, { recursive: true, force: true })
            }
        }
    } finally {
        try {
            if (ownsRecoveryLock) await rm(RECOVERY_LOCK_PATH, { recursive: true, force: true })
        } finally {
            if (reclaimedPath) await rm(reclaimedPath, { recursive: true, force: true })
        }
    }
}
