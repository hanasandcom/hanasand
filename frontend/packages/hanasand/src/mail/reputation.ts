import type { MailReputation } from './types.js'

export function isMailReputationClear(reputation?: MailReputation) {
    return reputation?.status === 'known' && reputation.flagged === 0
}
