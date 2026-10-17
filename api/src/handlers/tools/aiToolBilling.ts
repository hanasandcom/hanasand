export function positiveMetric(value: unknown) {
    const number = Number(value)
    return Number.isFinite(number) && number > 0 ? Math.round(number) : 0
}

export function estimateTokens(value: string) {
    return Math.max(0, Math.ceil(value.length / 4))
}

export function discountBillableUnits(totalTokens: number, billingMode: string, kind: string) {
    if (kind === 'ai_run_failed') {
        return Math.ceil(totalTokens * 0.25)
    }
    if (billingMode === 'draft') {
        return Math.ceil(totalTokens * 0.65)
    }
    return totalTokens
}

export function estimateRunCostNok({
    promptTokens,
    contextTokens,
    generatedTokens,
    browserChecks,
    buildMinutes,
    deployMinutes,
    billableUnits,
    billingMode,
}: {
    promptTokens: number
    contextTokens: number
    generatedTokens: number
    browserChecks: number
    buildMinutes: number
    deployMinutes: number
    billableUnits: number
    billingMode: string
}) {
    if (!billableUnits) {
        return 0
    }
    const inputCost = (promptTokens + contextTokens) * 0.000018
    const outputCost = generatedTokens * 0.000032
    const checkCost = browserChecks * 0.04
    const buildCost = buildMinutes * 0.16
    const deployCost = deployMinutes * 0.24
    const priorityMultiplier = billingMode === 'priority' ? 1.35 : billingMode === 'verified' ? 1.15 : 1
    return Number(((inputCost + outputCost + checkCost + buildCost + deployCost) * priorityMultiplier).toFixed(4))
}
