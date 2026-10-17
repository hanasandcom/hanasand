import { recordAiUsageEvent } from '#utils/ai/usage.ts'
import type { GeneratedBuilderResponse } from './aiProjectBuilder.ts'
import { parseGeneratedToolCalls } from './aiToolPolicy.ts'
import { discountBillableUnits, estimateRunCostNok, estimateTokens, positiveMetric } from './aiToolBilling.ts'
import type { ModelToolStrategy } from './aiToolContracts.ts'

type ToolAiEconomicsInput = {
    actorId: string | null
    billingMode?: 'draft' | 'standard' | 'verified' | 'priority'
    kind: 'ai_run_completed' | 'ai_run_failed' | 'ai_run_platform_error'
    outcome: string
    prompt: string
    context?: string
    responseText: string
    model: string
    conversationId?: string | null
    metrics?: GPT_ModelMetrics | null
    startedAt: number
    toolCalls?: number
    cache?: GeneratedBuilderResponse['cache']
    strategy?: ModelToolStrategy
}

export async function recordToolAiEconomics({
    actorId,
    billingMode = 'standard',
    kind,
    outcome,
    prompt,
    context,
    responseText,
    model,
    conversationId = null,
    metrics,
    startedAt,
    toolCalls = 0,
    cache,
    strategy,
}: ToolAiEconomicsInput) {
    if (!actorId) {
        return
    }

    const promptTokens = positiveMetric(metrics?.promptTokens) || estimateTokens(prompt)
    const contextTokens = positiveMetric(metrics?.contextTokens) || estimateTokens(context || '')
    const generatedTokens = positiveMetric(metrics?.generatedTokens) || estimateTokens(responseText)
    const totalTokens = Math.max(1, promptTokens + contextTokens + generatedTokens)
    const durationMs = Math.max(0, Date.now() - startedAt)
    const billableUnits = outcome === 'platform_error'
        ? 0
        : discountBillableUnits(totalTokens, billingMode, kind)
    const estimatedCostNok = estimateRunCostNok({
        promptTokens,
        contextTokens,
        generatedTokens,
        browserChecks: 0,
        buildMinutes: 0,
        deployMinutes: 0,
        billableUnits,
        billingMode,
    })

    await recordAiUsageEvent({
        ownerId: actorId,
        actorId,
        conversationId,
        kind,
        units: totalTokens,
        billableUnits,
        estimatedCostNok,
        billingMode,
        outcome,
        metadata: {
            model,
            promptTokens,
            contextTokens,
            generatedTokens,
            totalTokens,
            toolCalls,
            durationMs,
            costNok: estimatedCostNok,
            cacheHit: Boolean(cache?.hit),
            cacheKey: cache?.key || null,
            cacheCategory: cache?.category || null,
            keyMetric: 'verified useful project progress per minute per NOK',
            modelStrategy: strategy?.route || null,
            taskDifficulty: strategy?.difficulty || null,
            routingReason: strategy?.reason || null,
        },
    })
}

async function recordCommonCacheHit({
    actorId,
    prompt,
    context,
    response,
    billingMode = 'standard',
}: {
    actorId: string | null
    prompt: string
    context?: string
    response: GeneratedBuilderResponse
    billingMode?: 'draft' | 'standard' | 'verified' | 'priority'
}) {
    if (!actorId || !response.cache?.hit) {
        return
    }
    const estimatedSavedTokens = Math.max(1, estimateTokens(response.message) + estimateTokens(context || '') + estimateTokens(prompt))
    await recordAiUsageEvent({
        ownerId: actorId,
        actorId,
        kind: 'cache_hit',
        units: estimatedSavedTokens,
        billableUnits: 0,
        estimatedCostNok: 0,
        billingMode,
        outcome: 'cached',
        metadata: {
            cacheKey: response.cache.key,
            cacheCategory: response.cache.category,
            estimatedSavedTokens,
            message: 'Reused a common scaffold/diagnostic response instead of regenerating it.',
        },
    })
}

export async function recordBuilderResponse({
    actorId,
    prompt,
    context,
    response,
    billingMode,
    strategy,
}: {
    actorId: string | null
    prompt: string
    context?: string
    response: GeneratedBuilderResponse
    billingMode?: ToolAiEconomicsInput['billingMode']
    strategy: ModelToolStrategy
}) {
    await recordCommonCacheHit({ actorId, prompt, context, response, billingMode })
    await recordToolAiEconomics({
        actorId,
        billingMode,
        kind: 'ai_run_completed',
        outcome: 'completed',
        prompt,
        context,
        responseText: response.message,
        model: response.model,
        startedAt: Date.now(),
        toolCalls: parseGeneratedToolCalls(response.message).length,
        cache: response.cache,
        strategy,
    })
}
