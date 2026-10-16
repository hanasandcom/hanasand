import { paletteNames } from './darkThemeTokens.mjs'

export function checkDarkThemeContrast(sources, violations) {
    const { globals } = sources
    const themes = extractUiThemes(globals)
    for (const [themeName, theme] of Object.entries(themes)) {
        const warningText = warningTextColor(globals, themeName, theme['ui-text'], violations)
        for (const [foreground, background, minimum] of [
            ['ui-text', 'ui-canvas', 7], ['ui-text', 'ui-panel', 7], ['ui-text', 'ui-raised', 7],
            ['ui-muted', 'ui-canvas', 4.5], ['ui-muted', 'ui-panel', 4.5], ['ui-muted', 'ui-raised', 4.5],
            ['ui-primary', 'ui-panel', 4.5], ['ui-success', 'ui-panel', 4.5],
            ['ui-danger', 'ui-panel', 4.5],
        ]) {
            const ratio = contrastRatio(theme[foreground], theme[background])
            if (ratio < minimum) violations.push(`${themeName} palette contrast ${foreground} on ${background} is ${ratio.toFixed(2)}, expected >= ${minimum}`)
        }
        if (warningText) {
            const ratio = contrastRatio(warningText, theme['ui-panel'])
            if (ratio < 4.5) violations.push(`${themeName} palette contrast ui-warning-text on ui-panel is ${ratio.toFixed(2)}, expected >= 4.5`)
        }
    }
    if (!globals.includes('html body .text-ui-warning { color: var(--ui-warning-text) !important; }')) {
        violations.push('warning text should resolve through the semantic --ui-warning-text token')
    }
}

function warningTextColor(source, themeName, textColor, violations) {
    const selector = themeName === 'light' ? '.light' : '@theme'
    const block = styleBlock(source, selector)
    const token = block.match(/--ui-warning-text:\s*(#[0-9a-fA-F]{6}|var\(--ui-text\))/)?.[1]
    if (!token) {
        violations.push(`${themeName} theme should define --ui-warning-text as a readable color or --ui-text`)
        return null
    }
    return token === 'var(--ui-text)' ? textColor : token
}

function extractUiThemes(source) {
    return { dark: extractThemeBlock(source, '.dark'), light: extractThemeBlock(source, '.light') }
}

function extractThemeBlock(source, selector) {
    const block = styleBlock(source, selector)
    const defaults = styleBlock(source, '@theme')
    const values = {}
    for (const name of paletteNames) {
        const matcher = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`)
        const match = block.match(matcher) || (selector === '.dark' ? defaults.match(matcher) : null)
        if (!match) throw new Error(`Missing --${name} in ${selector}`)
        values[name] = match[1]
    }
    return values
}

function styleBlock(source, selector) {
    const start = source.indexOf(`${selector} {`)
    if (start === -1) return ''
    const end = source.indexOf('\n}', start)
    return source.slice(start, end)
}

function contrastRatio(first, second) {
    const a = relativeLuminance(hexToRgb(first))
    const b = relativeLuminance(hexToRgb(second))
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

function hexToRgb(hex) {
    const normalized = hex.replace('#', '')
    return [0, 2, 4].map(offset => parseInt(normalized.slice(offset, offset + 2), 16))
}

function relativeLuminance(rgb) {
    const [r, g, b] = rgb.map(channel => {
        const value = channel / 255
        return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
