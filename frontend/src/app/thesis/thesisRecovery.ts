import type { ThesisDocument } from '@/utils/thesis'

export type Recovery = ThesisDocument & { key: string, savedAt: number }
const prefix = 'hanasand-thesis-recovery:'

export const sameThesis = (a: ThesisDocument, b: ThesisDocument) => a.title === b.title && a.body === b.body

export function findRecoveries(initial: ThesisDocument) {
    let tabId = sessionStorage.getItem(prefix)
    if (!tabId) {
        tabId = crypto.randomUUID()
        sessionStorage.setItem(prefix, tabId)
    }
    const key = prefix + tabId
    const candidates = Object.keys(localStorage).filter(value => value.startsWith(prefix)).flatMap(value => {
        try {
            const item = JSON.parse(localStorage.getItem(value) || 'null')
            return item && typeof item.title === 'string' && typeof item.body === 'string' && Number.isSafeInteger(item.revision)
                ? [{ ...item, key: value } as Recovery] : []
        } catch {
            return []
        }
    }).filter(item => !sameThesis(item, initial)).sort((a, b) => b.savedAt - a.savedAt)
    const storedOwn = localStorage.getItem(key)
    if (storedOwn && sameThesis(JSON.parse(storedOwn), initial)) localStorage.removeItem(key)
    return { key, own: candidates.find(item => item.key === key) || null, others: candidates.filter(item => item.key !== key) }
}

export function writeRecovery(key: string, draft: ThesisDocument, shouldKeep: boolean) {
    if (shouldKeep) localStorage.setItem(key, JSON.stringify({ ...draft, savedAt: Date.now() }))
    else localStorage.removeItem(key)
}

export function removeRecoveredDraft(recovery: Recovery) {
    const previous = localStorage.getItem(recovery.key)
    if (previous && sameThesis(JSON.parse(previous), recovery)) localStorage.removeItem(recovery.key)
}
