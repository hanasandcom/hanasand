import { canonicalAliasClasses, canonicalLeadingScale, canonicalRadiusScale, canonicalSpacingScale, canonicalTextScale } from './canonicalScales.mjs'

export function getCanonicalClassSuggestion(token) {
    const aliasMatch = token.match(/^((?:[^:\s]+:)*)((?:!?[^:\s]+))$/)
    if (aliasMatch) {
        const [, variants, utility] = aliasMatch
        const canonicalAlias = canonicalAliasClasses.get(utility)
        if (canonicalAlias) {
            return `${variants}${canonicalAlias}`
        }
    }

    const negativeTranslateMatch = token.match(/^((?:[^:\s]+:)*)-translate-([xy])-\[([^\]]+)\]$/)
    if (negativeTranslateMatch) {
        const [, variants, axis, rawValue] = negativeTranslateMatch
        return `${variants}translate-${axis}-[-${rawValue}]`
    }

    const negativeVariableCalcMatch = token.match(
        /^((?:[^:\s]+:)*)((?:!?)(?:m(?:[trblxy])?|inset(?:-[xy])?|top|right|bottom|left))-\[calc\(var\((--[^)\]]+)\)\s*\*\s*-1\)\]$/
    )
    if (negativeVariableCalcMatch) {
        const [, variants, utility, variableName] = negativeVariableCalcMatch
        return `${variants}-${utility}-(${variableName})`
    }

    const variableMatch = token.match(/^((?:[^:\s]+:)*)((?:!?[^:\s[]+))-\[var\((--[^)\]]+)\)\](\/[^\s]+)?$/)
    if (variableMatch) {
        const [, variants, utility, variableName, suffix = ''] = variableMatch
        return `${variants}${utility}-(${variableName})${suffix}`
    }

    const arbitraryOpacityMatch = token.match(/^((?:[^:\s]+:)*)((?:!?[^:\s/][^:\s]*))\/\[(.+)\]$/)
    if (arbitraryOpacityMatch) {
        const [, variants, utility, rawValue] = arbitraryOpacityMatch
        const canonicalOpacity = normalizeOpacityValue(rawValue)
        if (canonicalOpacity) {
            return `${variants}${utility}/${canonicalOpacity}`
        }
    }

    for (const [utilityPattern, scale] of [
        [/^((?:[^:\s]+:)*)((?:-)?(?:p|m)(?:[trblxy])?|gap(?:-[xy])?|space-[xy]|(?:min-|max-)?[wh]|size)-\[(.+)\]$/, canonicalSpacingScale],
        [/^((?:[^:\s]+:)*)((?:-)?text)-\[(.+)\]$/, canonicalTextScale],
        [/^((?:[^:\s]+:)*)((?:-)?leading)-\[(.+)\]$/, canonicalLeadingScale],
        [/^((?:[^:\s]+:)*)((?:!?rounded(?:-(?:t|r|b|l|tl|tr|br|bl|s|e|ss|se|ee|es))?))-\[(.+)\]$/, canonicalRadiusScale],
    ]) {
        const match = token.match(utilityPattern)
        if (!match) {
            continue
        }

        const [, variants, utility, rawValue] = match
        const normalized = normalizeSpacingValue(rawValue)
        if (!normalized) {
            continue
        }

        const canonical = scale.get(normalized)
        if (canonical) {
            return `${variants}${utility}-${canonical}`
        }
    }

    return null
}

function normalizeSpacingValue(rawValue) {
    const value = rawValue.trim().toLowerCase()
    const remMatch = value.match(/^(-?\d+(?:\.\d+)?)rem$/)
    if (!remMatch) {
        const pxMatch = value.match(/^(-?\d+(?:\.\d+)?)px$/)
        if (!pxMatch) {
            return null
        }

        const numericPx = Number(pxMatch[1])
        if (!Number.isFinite(numericPx)) {
            return null
        }

        if (numericPx === 1) {
            return '1px'
        }

        return `${numericPx / 16}rem`
    }

    const numeric = Number(remMatch[1])
    if (!Number.isFinite(numeric)) {
        return null
    }

    return `${numeric}rem`
}

function normalizeOpacityValue(rawValue) {
    const value = rawValue.trim().toLowerCase()
    if (value.endsWith('%')) {
        const numericPercent = Number(value.slice(0, -1))
        if (Number.isInteger(numericPercent) && numericPercent >= 0 && numericPercent <= 100) {
            return `${numericPercent}`
        }

        return null
    }

    const numeric = Number(value)
    if (!Number.isFinite(numeric) || numeric < 0 || numeric > 100) {
        return null
    }

    if (numeric <= 1) {
        const percentage = numeric * 100
        if (Number.isInteger(percentage)) {
            return `${percentage}`
        }

        return null
    }

    if (Number.isInteger(numeric)) {
        return `${numeric}`
    }

    return null
}
