import { invalidateReadCache } from './readCache.ts'

const PROFILE_SSH_KEYS_CACHE_PREFIX = 'profile-ssh-keys:'

export function profileSshKeysResponseCacheKey(userId: string) {
    return `${PROFILE_SSH_KEYS_CACHE_PREFIX}${userId}:response`
}

export function invalidateProfileSshKeysResponseCache(userId: string) {
    invalidateReadCache(`${PROFILE_SSH_KEYS_CACHE_PREFIX}${userId}:`)
}
