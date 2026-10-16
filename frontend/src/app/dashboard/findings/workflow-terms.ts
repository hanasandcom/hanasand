export function countTerms(value: string) {
    return value.split(/[\n,]/).map(term => term.trim()).filter(Boolean).length
}

export function ensureTerm(value: string, term: string) {
    const cleanTerm = term.trim()
    if (!cleanTerm) return value
    const terms = value.split(/[\n,]/).map(item => item.trim()).filter(Boolean)
    const exists = terms.some(item => item.toLowerCase() === cleanTerm.toLowerCase())
    return (exists ? terms : [...terms, cleanTerm]).join('\n')
}

export function workflowTerms(value: string) {
    return value.split(/[\n,]/).map(term => term.trim()).filter(Boolean).join('\n')
}

export function validEvidenceUrl(value: string) {
    try {
        return new URL(value.trim()).protocol === 'https:'
    } catch {
        return false
    }
}
