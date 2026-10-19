import type { FastifyReply } from 'fastify'
import { matchApiKeyScope } from '#utils/auth/apiKeys.ts'
import { consumeSharedRateLimitBucket } from '#utils/rateLimit/config.ts'
import { withTransaction } from '#db'

export function credentialPeriodLimits({
    actorIdentifier,
    apiKeyScope,
    method,
    route,
}: {
    actorIdentifier: string
    apiKeyScope: ReturnType<typeof matchApiKeyScope>
    method: string
    route: string
}) {
    if (apiKeyScope) return apiKeyScope.limits
    return null
}

export async function consumeCredentialPeriodBudgets({
    actorIdentifier,
    method,
    route,
    limits,
}: {
    actorIdentifier: string
    method: string
    route: string
    limits: ApiKeyPeriodLimits
}) {
    const periodRules = [
        { period: 'second' as const, windowMs: 1_000, maxRequests: limits.perSecond },
        { period: 'minute' as const, windowMs: 60_000, maxRequests: limits.perMinute },
        { period: 'hour' as const, windowMs: 3_600_000, maxRequests: limits.perHour },
        { period: 'day' as const, windowMs: 86_400_000, maxRequests: limits.perDay },
    ]

    return withTransaction(async query => {
        const checks = []
        for (const periodRule of periodRules) {
            if (!periodRule.maxRequests || periodRule.maxRequests <= 0) continue
            checks.push({
                period: periodRule.period,
                limit: periodRule.maxRequests,
                ...await consumeSharedRateLimitBucket({
                    key: `${actorIdentifier}:endpoint:${method}:${route}:${periodRule.period}`,
                    rule: {
                        windowMs: periodRule.windowMs,
                        maxRequests: periodRule.maxRequests,
                    },
                }, query),
            })
        }
        return checks
    })
}

export function applyCredentialLimitHeaders(
    res: FastifyReply,
    checks: Array<{
        period: 'second' | 'minute' | 'hour' | 'day'
        limit: number
        remaining: number
        resetAt: number
    }>
) {
    for (const check of checks) {
        res.header(`x-api-key-rate-limit-${check.period}`, String(check.limit))
        res.header(`x-api-key-rate-limit-${check.period}-remaining`, String(check.remaining))
        res.header(`x-api-key-rate-limit-${check.period}-reset`, new Date(check.resetAt).toISOString())
    }
}
