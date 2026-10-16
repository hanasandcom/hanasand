import ts from 'typescript'
import { errors } from './context.mjs'
import { getCanonicalClassSuggestion } from './canonicalClasses.mjs'
import { validateBannedPublicCopy } from './contentRules.mjs'
import { formatLocation, getJsxAttributeText } from './sourceUtils.mjs'

export function validateAnchor(filePath, source, node) {
    const target = getJsxAttributeText(node, 'target')
    const href = getJsxAttributeText(node, 'href')
    const rel = getJsxAttributeText(node, 'rel')

    if (target === '_blank') {
        const relTokens = new Set((rel || '').split(/\s+/).filter(Boolean))
        if (!relTokens.has('noopener') || !relTokens.has('noreferrer')) {
            errors.push(`${formatLocation(filePath, source, node)}: external links using target="_blank" must include rel="noopener noreferrer".`)
        }
    }

    if (href && href.startsWith('/') && !href.startsWith('//')) {
        errors.push(`${formatLocation(filePath, source, node)}: use next/link for internal navigation instead of a raw <a href="${href}">.`)
    }
}

export function validateClassAttributes(filePath, source, node) {
    for (const attributeName of ['className', 'class']) {
        const value = getJsxAttributeText(node, attributeName)
        if (!value) {
            continue
        }

        const tokens = value.trim().split(/\s+/).filter(Boolean)
        if (tokens.length === 0) {
            continue
        }

        const seen = new Set()
        const duplicates = new Set()
        for (const token of tokens) {
            if (seen.has(token)) {
                duplicates.add(token)
            }
            seen.add(token)
        }

        if (duplicates.size > 0) {
            errors.push(`${formatLocation(filePath, source, node)}: ${attributeName} contains duplicate utility classes: ${Array.from(duplicates).join(', ')}.`)
        }

        for (const token of tokens) {
            const suggestion = getCanonicalClassSuggestion(token)
            if (suggestion) {
                errors.push(`${formatLocation(filePath, source, node)}: ${attributeName} uses \`${token}\`, write \`${suggestion}\` instead.`)
            }
        }
    }
}

export function validateTokenString(filePath, source, node, value, label) {
    const tokens = value.trim().split(/\s+/).filter(Boolean)
    for (const token of tokens) {
        const suggestion = getCanonicalClassSuggestion(token)
        if (suggestion) {
            errors.push(`${formatLocation(filePath, source, node)}: ${label} uses \`${token}\`, write \`${suggestion}\` instead.`)
        }
    }
}
export function shouldValidateStringLiteral(node) {
    if (ts.isJsxAttribute(node.parent)) {
        return isCopyAttribute(node.parent)
    }

    if (ts.isJsxExpression(node.parent) && ts.isJsxAttribute(node.parent.parent)) {
        return isCopyAttribute(node.parent.parent)
    }

    return true
}

function isCopyAttribute(attribute) {
    const name = attribute.name?.getText?.() || ''
    return new Set([
        'aria-label',
        'body',
        'description',
        'detail',
        'empty',
        'fallback',
        'label',
        'message',
        'placeholder',
        'subtitle',
        'title',
        'value',
    ]).has(name)
}
