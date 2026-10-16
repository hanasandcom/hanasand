export async function collectContrastIssues(page) {
    return page.evaluate(() => {
        function parseRgb(value) {
            const match = value.match(/rgba?\(([^)]+)\)/)
            if (!match) return null
            const [r, g, b, a = '1'] = match[1].split(',').map(part => Number(part.trim()))
            if ([r, g, b, a].some(channel => Number.isNaN(channel))) return null
            return { r, g, b, a }
        }
        function mixColors(foreground, background) {
            const alpha = foreground.a ?? 1
            return { r: foreground.r * alpha + background.r * (1 - alpha), g: foreground.g * alpha + background.g * (1 - alpha), b: foreground.b * alpha + background.b * (1 - alpha), a: 1 }
        }
        function luminance(color) {
            const channels = [color.r, color.g, color.b].map(channel => {
                const normalized = channel / 255
                return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
            })
            return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
        }
        function contrastRatio(first, second) {
            const lighter = Math.max(luminance(first), luminance(second))
            const darker = Math.min(luminance(first), luminance(second))
            return (lighter + 0.05) / (darker + 0.05)
        }
        function effectiveBackground(element) {
            let current = element
            while (current && current !== document.documentElement) {
                const background = parseRgb(window.getComputedStyle(current).backgroundColor)
                if (background && (background.a ?? 1) > 0.05) {
                    if ((background.a ?? 1) >= 0.98) return background
                    const parent = current.parentElement ? effectiveBackground(current.parentElement) : parseRgb(window.getComputedStyle(document.body).backgroundColor)
                    return parent ? mixColors(background, parent) : background
                }
                current = current.parentElement
            }
            return parseRgb(window.getComputedStyle(document.body).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 }
        }
        function elementSelector(element) {
            if (element.id) return `#${element.id}`
            const attr = ['data-readiness-row-id', 'data-ti-command-bar', 'aria-label']
                .map(name => element.getAttribute(name) ? `[${name}="${element.getAttribute(name)}"]` : '').find(Boolean)
            if (attr) return attr
            const className = String(element.getAttribute('class') || '').split(/\s+/).filter(Boolean).slice(0, 3).join('.')
            return `${element.tagName.toLowerCase()}${className ? `.${className}` : ''}`
        }
        function isLeafTextElement(element) {
            const text = (element.textContent || '').replace(/\s+/g, ' ').trim()
            if (!text || text.length > 90 || element.querySelector('button, a, input, textarea, select')) return false
            const childText = Array.from(element.children).map(child => (child.textContent || '').replace(/\s+/g, ' ').trim()).join(' ').trim()
            return childText.length < text.length
        }
        function shouldSampleContrast(element, style) {
            if (!isLeafTextElement(element) || style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) < 0.45) return false
            const rect = element.getBoundingClientRect()
            if (rect.width <= 0 || rect.height <= 0 || rect.bottom < 0 || rect.top > window.innerHeight + 1200) return false
            const className = String(element.getAttribute('class') || '')
            const role = element.getAttribute('role') || ''
            if (element.closest('button, a, [role="button"], [role="option"], [role="tab"], [role="listitem"]')) return true
            if (/rounded|badge|pill|chip|tag|status|bg-\[|bg-|border-\[/.test(className)) return true
            return /button|option|tab|status/.test(role)
        }
        const issues = []
        for (const element of Array.from(document.querySelectorAll('body *'))) {
            const style = window.getComputedStyle(element)
            if (!shouldSampleContrast(element, style)) continue
            const foreground = parseRgb(style.color)
            const background = effectiveBackground(element)
            if (!foreground || !background) continue
            const ratio = contrastRatio(foreground, background)
            const fontSize = Number.parseFloat(style.fontSize)
            const fontWeight = Number.parseInt(style.fontWeight, 10)
            const threshold = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 600) ? 3 : 4.5
            if (ratio >= threshold) continue
            issues.push({ ratio, threshold, text: (element.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80), selector: elementSelector(element) })
            if (issues.length >= 12) break
        }
        return issues
    })
}
