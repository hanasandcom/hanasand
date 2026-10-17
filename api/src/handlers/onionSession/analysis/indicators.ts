const GENERIC_DOTTED_IDENTIFIERS = new Set([
    'document.createelement', 'document.body', 'document.head', 'document.cookie', 'document.location',
    'window.location', 'window.history', 'object.assign', 'object.create', 'json.parse', 'json.stringify',
    'console.log', 'el.style', 'el.textcontent', 'element.style',
])

export function extractIndicators(value: string) {
    const domains = value.match(/\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b/gi) || []
    const ips = (value.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g) || [])
        .filter(ip => ip.split('.').every(part => Number(part) >= 0 && Number(part) <= 255))
    const urls = value.match(/https?:\/\/[^\s"'<>]+/gi) || []
    return {
        domains: Array.from(new Set(domains.map(item => item.toLowerCase()).filter(isUsefulDomainIndicator))).slice(0, 80),
        ips: Array.from(new Set(ips)).slice(0, 80),
        urls: Array.from(new Set(urls.filter(isUsefulUrlIndicator))).slice(0, 80),
    }
}

function isUsefulDomainIndicator(value: string) {
    if (GENERIC_DOTTED_IDENTIFIERS.has(value)) return false
    return !/^(?:document|window|object|array|string|number|console|json|math|element|el|node|event|navigator|location|history|localstorage|sessionstorage)\./i.test(value)
}

function isUsefulUrlIndicator(value: string) {
    try {
        return isUsefulDomainIndicator(new URL(value).hostname.toLowerCase())
    } catch {
        return false
    }
}
